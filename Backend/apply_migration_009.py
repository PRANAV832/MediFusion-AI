import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('d:/MediFusion/backend/.env')
db_url = os.getenv('DATABASE_URL')

with open('d:/MediFusion/supabase/migrations/009_phase9_rag_knowledge.sql', 'r', encoding='utf-8') as f:
    migration_sql = f.read()

print("Connecting to database...")
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

print("Applying migration 009_phase9_rag_knowledge.sql...")
cur.execute(migration_sql)
print("Migration applied successfully!")

# Verify table and RPC
cur.execute("""
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'patient_knowledge_chunks';
""")
table_exists = cur.fetchone()
print(f"patient_knowledge_chunks table created: {table_exists is not None}")

cur.execute("""
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'match_patient_evidence';
""")
func_exists = cur.fetchone()
print(f"match_patient_evidence function created: {func_exists is not None}")

conn.close()
