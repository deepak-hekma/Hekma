import os
import json
import glob
from datetime import datetime
from dotenv import load_dotenv
from neo4j import GraphDatabase

# Load environment variables
load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

def clean_ref(ref_str):
    if not ref_str:
        return None
    if ref_str.startswith("urn:uuid:"):
        return ref_str[len("urn:uuid:"):]
    if "/" in ref_str:
        return ref_str.split("/")[-1]
    return ref_str

def format_date(date_str):
    if not date_str:
        return ""
    # Truncate time parts or keep as is. Synthea usually provides ISO format e.g. "2025-05-18T10:00:00Z"
    # We will store it as a clean ISO string (split at T to get just date for some labels, or keep whole string)
    return date_str.split("T")[0]

def extract_patient_info(resource):
    patient_id = resource.get("id")
    names = resource.get("name", [{}])
    given = " ".join(names[0].get("given", []))
    family = names[0].get("family", "")
    name = f"{given} {family}".strip()
    
    gender = resource.get("gender", "unknown")
    birth_date = resource.get("birthDate", "")
    
    # Compute age and pronouns
    pronouns = "they/them"
    if gender.lower() == "male":
        pronouns = "he/him"
    elif gender.lower() == "female":
        pronouns = "she/her"
        
    age = 0
    if birth_date:
        try:
            birth_year = int(birth_date.split("-")[0])
            # Default reference year is current year (2026)
            age = 2026 - birth_year
        except Exception:
            pass
            
    # Extract address
    addresses = resource.get("address", [{}])
    lines = ", ".join(addresses[0].get("line", []))
    city = addresses[0].get("city", "")
    state = addresses[0].get("state", "")
    postal_code = addresses[0].get("postalCode", "")
    country = addresses[0].get("country", "")
    
    address_str = f"{lines}, {city}, {state} {postal_code}, {country}".strip(", ")
    
    return {
        "id": patient_id,
        "name": name,
        "gender": gender,
        "birthDate": birth_date,
        "pronouns": pronouns,
        "age": age,
        "address": address_str
    }

def parse_observation(resource):
    obs_id = resource.get("id")
    title = resource.get("code", {}).get("text", "Observation")
    date = format_date(resource.get("effectiveDateTime", ""))
    
    # Build subtitle from value
    subtitle = ""
    status = "normal"
    fields = []
    
    # If it's blood pressure (systolic/diastolic components)
    components = resource.get("component", [])
    if components:
        bp_parts = []
        for comp in components:
            comp_title = comp.get("code", {}).get("text", "")
            val_qty = comp.get("valueQuantity", {})
            val = val_qty.get("value")
            unit = val_qty.get("unit", "")
            if val is not None:
                bp_parts.append(str(int(val)))
                fields.append({"label": comp_title, "value": f"{val} {unit}"})
        if bp_parts:
            subtitle = " / ".join(bp_parts) + " mmHg"
    else:
        # Single value
        val_qty = resource.get("valueQuantity", {})
        val = val_qty.get("value")
        unit = val_qty.get("unit", "")
        if val is not None:
            # Check interpretation
            interpretations = resource.get("interpretation", [{}])
            interp_text = interpretations[0].get("coding", [{}])[0].get("code", "")
            
            # Map interpretation to status
            if interp_text in ["H", "HU"]:
                status = "high"
            elif interp_text in ["L", "LU"]:
                status = "low"
            elif interp_text in ["A", "B"]:
                status = "borderline"
            else:
                status = "normal"
                
            subtitle = f"{val} {unit}"
            if interp_text:
                subtitle += f" · {interpretations[0].get('text', '').lower()}"
                
            fields.append({"label": "Result", "value": f"{val} {unit}"})
            
            # Extract reference range
            ref_ranges = resource.get("referenceRange", [{}])
            low = ref_ranges[0].get("low", {}).get("value")
            high = ref_ranges[0].get("high", {}).get("value")
            ref_unit = ref_ranges[0].get("low", {}).get("unit", unit)
            if low is not None and high is not None:
                ref_str = f"{low} – {high} {ref_unit}"
                fields.append({"label": "Reference range", "value": ref_str})
                
    provider = resource.get("performer", [{}])[0].get("display", "Bay Area Lab Partners")
    notes = resource.get("note", [{}])[0].get("text", "")
    
    return {
        "id": obs_id,
        "resourceType": "Observation",
        "title": title,
        "date": date,
        "subtitle": subtitle,
        "status": status,
        "provider": provider,
        "fields": fields,
        "notes": notes
    }

def parse_medication_request(resource):
    med_id = resource.get("id")
    title = resource.get("medicationCodeableConcept", {}).get("text", "Medication")
    date = format_date(resource.get("authoredOn", ""))
    
    dosage = resource.get("dosageInstruction", [{}])[0]
    subtitle = dosage.get("text", "As directed")
    
    status_raw = resource.get("status", "active")
    status = "active" if status_raw in ["active", "on-hold"] else "completed"
    
    fields = []
    dose_qty = dosage.get("doseAndRate", [{}])[0].get("doseQuantity", {})
    if dose_qty:
        fields.append({"label": "Dose", "value": f"{dose_qty.get('value', '')} {dose_qty.get('unit', '')}"})
        
    timing = dosage.get("timing", {}).get("repeat", {})
    if timing:
        freq = timing.get("frequency", "")
        period = timing.get("period", "")
        period_unit = timing.get("periodUnit", "")
        if freq and period:
            fields.append({"label": "Frequency", "value": f"{freq} times every {period} {period_unit}"})
            
    fields.append({"label": "Started", "value": date})
    
    notes = resource.get("note", [{}])[0].get("text", "")
    
    return {
        "id": med_id,
        "resourceType": "MedicationStatement", # mapped to MedicationStatement in mockFhir
        "title": title,
        "date": date,
        "subtitle": subtitle,
        "status": status,
        "fields": fields,
        "notes": notes
    }

def parse_condition(resource):
    cond_id = resource.get("id")
    title = resource.get("code", {}).get("text", "Condition")
    date = format_date(resource.get("recordedDate", resource.get("onsetDateTime", "")))
    
    clinical_status = resource.get("clinicalStatus", {}).get("coding", [{}])[0].get("code", "active")
    status = "active" if clinical_status == "active" else "resolved"
    
    subtitle = "Active diagnosis" if status == "active" else "Resolved diagnosis"
    
    fields = [
        {"label": "Onset", "value": date},
        {"label": "Severity", "value": resource.get("severity", {}).get("text", "Mild")}
    ]
    
    notes = resource.get("note", [{}])[0].get("text", "")
    
    return {
        "id": cond_id,
        "resourceType": "Condition",
        "title": title,
        "date": date,
        "subtitle": subtitle,
        "status": status,
        "fields": fields,
        "notes": notes
    }

def parse_encounter(resource):
    enc_id = resource.get("id")
    title = resource.get("type", [{}])[0].get("text", "Office Visit")
    date = format_date(resource.get("period", {}).get("start", ""))
    
    class_val = resource.get("class", {}).get("display", "Encounter")
    status_raw = resource.get("status", "completed")
    status = "completed" if status_raw == "finished" else status_raw
    
    subtitle = f"{class_val} visit"
    
    provider = resource.get("serviceProvider", {}).get("display", "Mission Bay Clinic")
    
    fields = [
        {"label": "Type", "value": title},
        {"label": "Location", "value": provider}
    ]
    
    notes = ""
    reason = resource.get("reasonCode", [{}])[0].get("text")
    if reason:
        notes = f"Reason for visit: {reason}."
        
    return {
        "id": enc_id,
        "resourceType": "Encounter",
        "title": title,
        "date": date,
        "subtitle": subtitle,
        "status": status,
        "provider": provider,
        "fields": fields,
        "notes": notes
    }

def parse_immunization(resource):
    imm_id = resource.get("id")
    title = resource.get("vaccineCode", {}).get("text", "Vaccine")
    date = format_date(resource.get("occurrenceDateTime", ""))
    
    status = resource.get("status", "completed")
    subtitle = "Completed" if status == "completed" else status
    
    fields = [
        {"label": "Vaccine", "value": title},
        {"label": "Site", "value": resource.get("site", {}).get("text", "Left deltoid")}
    ]
    
    return {
        "id": imm_id,
        "resourceType": "Immunization",
        "title": title,
        "date": date,
        "subtitle": subtitle,
        "status": "completed",
        "fields": fields
    }

def parse_allergy_intolerance(resource):
    all_id = resource.get("id")
    title = resource.get("code", {}).get("text", "Allergy")
    date = format_date(resource.get("recordedDate", ""))
    
    clinical_status = resource.get("clinicalStatus", {}).get("coding", [{}])[0].get("code", "active")
    status = "active" if clinical_status == "active" else "resolved"
    
    reaction = resource.get("reaction", [{}])[0]
    manifestation = reaction.get("manifestation", [{}])[0].get("text", "Watery eyes")
    severity = reaction.get("severity", "mild")
    
    subtitle = f"{manifestation} · {severity}"
    
    fields = [
        {"label": "Reaction", "value": manifestation},
        {"label": "Severity", "value": severity.capitalize()}
    ]
    
    return {
        "id": all_id,
        "resourceType": "AllergyIntolerance",
        "title": title,
        "date": date,
        "subtitle": subtitle,
        "status": status,
        "fields": fields
    }

def insert_data(tx, patient_node, records_list, relationships):
    # Merge Patient
    tx.run(
        """
        MERGE (p:Patient {id: $id})
        SET p.name = $name,
            p.gender = $gender,
            p.birthDate = $birthDate,
            p.pronouns = $pronouns,
            p.age = $age,
            p.address = $address
        """,
        patient_node
    )
    
    # Merge Records
    for rec in records_list:
        # Serialize fields and raw to JSON strings
        rec_params = dict(rec)
        rec_params["fields_json"] = json.dumps(rec.get("fields", []))
        rec_params["raw_json"] = json.dumps(rec.get("raw", {}))
        
        tx.run(
            """
            MERGE (r:Record {id: $id})
            SET r.resourceType = $resourceType,
                r.title = $title,
                r.date = $date,
                r.subtitle = $subtitle,
                r.status = $status,
                r.provider = $provider,
                r.notes = $notes,
                r.fields = $fields_json,
                r.raw = $raw_json
            """,
            rec_params
        )
        
        # Link Record to Patient
        tx.run(
            """
            MATCH (p:Patient {id: $patient_id})
            MATCH (r:Record {id: $record_id})
            MERGE (p)-[:HAS_RECORD]->(r)
            """,
            {"patient_id": patient_node["id"], "record_id": rec["id"]}
        )
        
    # Merge Relationships (e.g. Encounter -> Records)
    for rel in relationships:
        tx.run(
            """
            MATCH (parent:Record {id: $parent_id})
            MATCH (child:Record {id: $child_id})
            MERGE (parent)-[:HAS_PART]->(child)
            """,
            rel
        )

def main():
    print(f"Connecting to Neo4j at {NEO4J_URI}...")
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    # Create indexes for high performance queries
    with driver.session() as session:
        print("Setting up Neo4j Indexes...")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (p:Patient) REQUIRE p.id IS UNIQUE")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (r:Record) REQUIRE r.id IS UNIQUE")
        
    # Get JSON files
    fhir_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "my-ehr-guide", "Data", "fhir"))
    json_pattern = os.path.join(fhir_dir, "*.json")
    files = glob.glob(json_pattern)
    print(f"Found {len(files)} patient bundle JSON files in {fhir_dir}.")
    
    parsed_count = 0
    for idx, filepath in enumerate(files):
        filename = os.path.basename(filepath)
        print(f"[{idx+1}/{len(files)}] Processing {filename}...")
        
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                bundle = json.load(f)
                
            if bundle.get("resourceType") != "Bundle":
                print(f"Skipping {filename}: not a FHIR Bundle.")
                continue
                
            entries = bundle.get("entry", [])
            
            # Find patient first
            patient_resource = None
            for e in entries:
                res = e.get("resource", {})
                if res.get("resourceType") == "Patient":
                    patient_resource = res
                    break
                    
            if not patient_resource:
                print(f"Skipping {filename}: no Patient resource found.")
                continue
                
            patient_node = extract_patient_info(patient_resource)
            patient_id = patient_node["id"]
            
            records_list = []
            relationships = []
            
            # Now parse other resources
            for e in entries:
                res = e.get("resource", {})
                res_type = res.get("resourceType")
                res_id = res.get("id")
                
                if res_type == "Patient" or not res_id:
                    continue
                    
                parsed_rec = None
                if res_type == "Observation":
                    parsed_rec = parse_observation(res)
                elif res_type == "MedicationRequest":
                    parsed_rec = parse_medication_request(res)
                elif res_type == "Condition":
                    parsed_rec = parse_condition(res)
                elif res_type == "Encounter":
                    parsed_rec = parse_encounter(res)
                elif res_type == "Immunization":
                    parsed_rec = parse_immunization(res)
                elif res_type == "AllergyIntolerance":
                    parsed_rec = parse_allergy_intolerance(res)
                    
                if parsed_rec:
                    # Inject raw and clean up fields
                    parsed_rec["raw"] = res
                    # provider defaults
                    if "provider" not in parsed_rec:
                        parsed_rec["provider"] = ""
                    if "notes" not in parsed_rec:
                        parsed_rec["notes"] = ""
                        
                    records_list = [r for r in records_list if r["id"] != parsed_rec["id"]]
                    records_list.append(parsed_rec)
                    
                    # If this record is linked to an encounter, record relationship
                    enc_ref = res.get("encounter", {}).get("reference")
                    if enc_ref:
                        parent_id = clean_ref(enc_ref)
                        if parent_id:
                            relationships.append({
                                "parent_id": parent_id,
                                "child_id": parsed_rec["id"]
                            })
                            
            # Open transaction and write data
            with driver.session() as session:
                session.execute_write(insert_data, patient_node, records_list, relationships)
                
            parsed_count += 1
            
        except Exception as e:
            print(f"Error parsing {filename}: {e}")
            import traceback
            traceback.print_exc()
            
    driver.close()
    print(f"\nETL completed successfully! Loaded {parsed_count} patients and their records into Neo4j.")

if __name__ == "__main__":
    main()
