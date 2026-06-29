import os
import json
from flask import Flask, request, Response, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from neo4j import GraphDatabase
from groq import Groq

# Load environment variables
load_dotenv(override=True)

app = Flask(__name__)
# Enable CORS for frontend dev server
CORS(app, resources={r"/api/*": {"origins": "*"}})

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def get_db_driver():
    try:
        return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    except Exception as e:
        print(f"Error creating Neo4j driver: {e}")
        return None

@app.route("/api/health", methods=["GET"])
def health():
    driver = get_db_driver()
    db_status = "unknown"
    if driver:
        try:
            with driver.session() as session:
                session.run("RETURN 1")
            db_status = "connected"
        except Exception as e:
            db_status = f"error: {str(e)}"
        finally:
            driver.close()
    return jsonify({
        "status": "healthy",
        "database": db_status,
        "config": {
            "neo4j_uri": NEO4J_URI,
            "has_groq_key": bool(GROQ_API_KEY)
        }
    })

@app.route("/api/patients", methods=["GET"])
def get_patients():
    driver = get_db_driver()
    if not driver:
        return jsonify({"error": "Neo4j driver not configured"}), 500
        
    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (p:Patient)
                RETURN p {.*} as patient
                ORDER BY p.name
                """
            )
            patients_list = []
            for record in result:
                p = record["patient"]
                # Provide a reason and lastVisit placeholder if not populated
                if "reason" not in p:
                    p["reason"] = "Annual review"
                if "lastVisit" not in p:
                    # Look up last Encounter date
                    enc_result = session.run(
                        """
                        MATCH (p:Patient {id: $id})-[:HAS_RECORD]->(r:Record {resourceType: 'Encounter'})
                        RETURN r.date as date
                        ORDER BY r.date DESC
                        LIMIT 1
                        """,
                        {"id": p["id"]}
                    )
                    enc_record = enc_result.single()
                    p["lastVisit"] = enc_record["date"] if enc_record else p.get("birthDate", "2025-01-01")
                patients_list.append(p)
                
            return jsonify(patients_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        driver.close()

@app.route("/api/patients/<patient_id>/records", methods=["GET"])
def get_patient_records(patient_id):
    driver = get_db_driver()
    if not driver:
        return jsonify({"error": "Neo4j driver not configured"}), 500
        
    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (p:Patient {id: $patient_id})-[:HAS_RECORD]->(r:Record)
                RETURN r {.*} as record
                ORDER BY r.date DESC
                """,
                {"patient_id": patient_id}
            )
            
            records_list = []
            for row in result:
                r = row["record"]
                # Deserialize JSON strings
                if "fields" in r and isinstance(r["fields"], str):
                    try:
                        r["fields"] = json.loads(r["fields"])
                    except Exception:
                        r["fields"] = []
                if "raw" in r and isinstance(r["raw"], str):
                    try:
                        r["raw"] = json.loads(r["raw"])
                    except Exception:
                        r["raw"] = {}
                records_list.append(r)
                
            return jsonify(records_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        driver.close()

@app.route("/api/chat", methods=["POST"])
def chat():
    if not GROQ_API_KEY:
        return "Error: GROQ_API_KEY is not configured.", 500
        
    body = request.get_json() or {}
    query = body.get("query", "").strip()
    patient_id = body.get("patientId")
    context_record_id = body.get("contextRecordId")
    history = body.get("history", [])
    
    if not query:
        return "Empty query", 400
        
    driver = get_db_driver()
    if not driver:
        return "Neo4j driver error", 500
        
    patient_info = None
    records_serialized = ""
    context_record_str = ""
    
    try:
        with driver.session() as session:
            # 1. Fetch Patient details
            if patient_id:
                p_result = session.run("MATCH (p:Patient {id: $id}) RETURN p {.*} as patient", {"id": patient_id})
                p_rec = p_result.single()
                if p_rec:
                    patient_info = p_rec["patient"]
            
            # 2. Fetch context record if specified
            if context_record_id:
                cr_result = session.run("MATCH (r:Record {id: $id}) RETURN r {.*} as record", {"id": context_record_id})
                cr_rec = cr_result.single()
                if cr_rec:
                    r = cr_rec["record"]
                    fields_list = json.loads(r["fields"]) if isinstance(r.get("fields"), str) else r.get("fields", [])
                    fields_str = "\n".join([f"    - {f['label']}: {f['value']}" for f in fields_list])
                    context_record_str = (
                        f"\nTHE USER IS ASKING SPECIFICALLY ABOUT THIS RECORD:\n"
                        f"- id: {r.get('id')}\n"
                        f"  type: {r.get('resourceType')}\n"
                        f"  title: {r.get('title')}\n"
                        f"  date: {r.get('date')}\n"
                        f"  subtitle: {r.get('subtitle')}\n"
                        f"  status: {r.get('status')}\n"
                        f"  provider: {r.get('provider')}\n"
                        f"  fields:\n{fields_str}\n"
                        f"  notes: {r.get('notes')}\n"
                    )
            
            # 3. Fetch patient records to serialize for system prompt context
            # To avoid rate limits (8000 TPM), we limit context to the 15 most important records and cap fields per record.
            if patient_id:
                r_result = session.run(
                    """
                    MATCH (p:Patient {id: $patient_id})-[:HAS_RECORD]->(r:Record)
                    // Prioritize conditions, medications, allergies, and recent items
                    WITH r,
                         CASE WHEN r.resourceType IN ['Condition', 'MedicationStatement', 'AllergyIntolerance'] THEN 0 ELSE 1 END as priority
                    RETURN r {.*} as record
                    ORDER BY priority ASC, r.date DESC
                    LIMIT 15
                    """,
                    {"patient_id": patient_id}
                )
                
                serialized_items = []
                for row in r_result:
                    r = row["record"]
                    fields_list = json.loads(r["fields"]) if isinstance(r.get("fields"), str) else r.get("fields", [])
                    # Cap serialized fields at 8 to keep context size small
                    fields_str = "\n".join([f"    - {f['label']}: {f['value']}" for f in fields_list[:8]])
                    
                    item = [
                        f"- id: {r.get('id')}",
                        f"  type: {r.get('resourceType')}",
                        f"  title: {r.get('title')}",
                        f"  date: {r.get('date')}",
                        r.get("subtitle") and f"  summary: {r.get('subtitle')}",
                        r.get("status") and f"  status: {r.get('status')}",
                        r.get("provider") and f"  provider: {r.get('provider')}",
                        fields_str and f"  fields:\n{fields_str}",
                        r.get("notes") and f"  notes: {r.get('notes')}"
                    ]
                    serialized_items.append("\n".join(filter(None, item)))
                
                records_serialized = "\n\n".join(serialized_items)
    except Exception as e:
        print(f"Error querying database for chat context: {e}")
    finally:
        driver.close()
        
    # Standard fallback patient details if patient_id is not found or db is empty
    p_name = patient_info.get("name", "the patient") if patient_info else "the patient"
    p_age = patient_info.get("age", 40) if patient_info else 40
    p_pronouns = patient_info.get("pronouns", "they/them") if patient_info else "they/them"
    
    # Construct System Prompt
    system_prompt = (
        f"You are Hekma, a warm and approachable health assistant for {p_name} (age {p_age}, {p_pronouns}). "
        f"You help the patient understand their own medical records.\n\n"
        f"RULES:\n"
        f"- Only use information from the records below. Never invent values, dates, providers, or diagnoses.\n"
        f"- If the question can't be answered from the records, say so plainly and suggest related things you CAN answer.\n"
        f"- Be warm, plain-language, and concise. Use short paragraphs and bullet lists.\n"
        f"- End every substantive medical reply with: _Educational summary based on your records, not medical advice._\n"
        f"- When you reference a record, append a line at the very end of your message in this exact format (no other text after it):\n"
        f"  SOURCES: id1, id2\n"
        f"  Use the record ids exactly as given. Omit the SOURCES line if no records were used.\n\n"
        f"PATIENT RECORDS:\n"
        f"{records_serialized}\n"
        f"{context_record_str}"
    )
    
    # Format messages for the main conversational LLM
    llm_messages = [{"role": "system", "content": system_prompt}]
    for m in history[-4:]:  # Keep last 4 messages to save context tokens
        llm_messages.append({"role": m.get("role"), "content": m.get("content")})
    llm_messages.append({"role": "user", "content": query})
    
    # Call Groq completions API
    def generate():
        try:
            client = Groq(api_key=GROQ_API_KEY)
            
            # Step 1: Run safety check via meta-llama/llama-prompt-guard-2-86m
            safety_score = 0.0
            try:
                safety_check = client.chat.completions.create(
                    model="meta-llama/llama-prompt-guard-2-86m",
                    messages=[{"role": "user", "content": query}],
                    temperature=1,
                    max_completion_tokens=1,
                    top_p=1,
                    stream=False,
                    stop=None
                )
                score_str = safety_check.choices[0].message.content or "0.0"
                safety_score = float(score_str.strip())
            except Exception as se:
                print(f"Safety check warning: {se}")
                # Fallback to safe on parsing or network error to avoid blocking the user
                safety_score = 0.0
                
            if safety_score > 0.5:
                yield "I'm sorry, I cannot process this query as it may contain unsafe instruction patterns."
                return
                
            # Step 2: Query the main model for a conversational health assistant response
            completion = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=llm_messages,
                temperature=1,
                max_completion_tokens=1024,
                top_p=1,
                reasoning_effort="medium",
                stream=True,
                stop=None
            )
            
            for chunk in completion:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield delta
                    
        except Exception as e:
            yield f"Error calling AI completions service: {str(e)}"
            
    return Response(generate(), content_type="text/plain; charset=utf-8")

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
