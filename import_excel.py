import os
import zipfile
import xml.etree.ElementTree as ET
import re
from supabase import create_client

# 1. Configuration Supabase (récupérées depuis vos variables d'environnement ou directement)
SUPABASE_URL = "https://axraidlcnpdmwysvptbm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cmFpZGxjbnBkbXd5c3ZwdGJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyODE3NTksImV4cCI6MjEwNjg1Nzc1OX0.UT9oXpLsB3W6SqCytGIXwQq_p5mYJuBKQMesu8elNFs"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
excel_file = "Arbre_généalogique_Famille_MADEKE_MOUKOUMBI - 06102026.xlsx"

def extract_names_from_sheet(sheet_path, shared_strings):
    tree = ET.parse(sheet_path)
    root = tree.getroot()
    ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    
    names = []
    for c in root.findall('.//main:c', ns):
        t = c.attrib.get('t')
        v = c.find('main:v', ns)
        if v is not None and v.text is not None:
            val = v.text
            if t == 's':
                val = shared_strings[int(val)]
            val_str = val.strip()
            # Filtrer les en-têtes et titres
            if val_str and not val_str.startswith("Arbre généalogique") and not val_str.startswith("Famille"):
                names.append(val_str)
    return list(set(names)) # Supprimer les doublons

def run_import():
    if not os.path.exists(excel_file):
        print(f"Erreur : Le fichier {excel_file} est introuvable à la racine.")
        return

    # Extraction des chaînes partagées du fichier Excel (.xlsx est un zip)
    temp_dir = "temp_excel_extract"
    with zipfile.ZipFile(excel_file, 'r') as z:
        z.extractall(temp_dir)

    shared_strings = []
    ss_path = os.path.join(temp_dir, 'xl', 'sharedStrings.xml')
    if os.path.exists(ss_path):
        tree = ET.parse(ss_path)
        root = tree.getroot()
        for si in root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
            shared_strings.append(si.text if si.text is not None else "")

    # Feuille 1 : Famille Moukoumbi
    s1_path = os.path.join(temp_dir, 'xl', 'worksheets', 'sheet1.xml')
    moukoumbi_names = extract_names_from_sheet(s1_path, shared_strings)
    
    # Feuille 2 : Famille Madeke
    s2_path = os.path.join(temp_dir, 'xl', 'worksheets', 'sheet2.xml')
    madeke_names = extract_names_from_sheet(s2_path, shared_strings)

    # Nettoyage du dossier temporaire
    import shutil
    shutil.rmtree(temp_dir)

    print(f"--- Import Famille MOUKOUMBI ({len(moukoumbi_names)} membres) ---")
    for full_name in moukoumbi_names:
        insert_person(full_name, "MOUKOUMBI")

    print(f"\n--- Import Famille MADEKE ({len(madeke_names)} membres) ---")
    for full_name in madeke_names:
        insert_person(full_name, "MADEKE")

    print("\nImportation terminée avec succès !")

def insert_person(full_name, branche_origine):
    # Séparation basique Nom / Prénom
    parts = full_name.split(' ', 1)
    nom = parts[0].upper()
    prenom = parts[1] if len(parts) > 1 else ""

    data = {
        "nom": nom,
        "prenom": prenom,
        "surnom": f"Branche {branche_origine}"
    }

    try:
        response = supabase.table("persons").insert(data).execute()
        print(f"Ajouté : {nom} {prenom}")
    except Exception as e:
        print(f"Erreur pour {full_name}: {e}")

if __name__ == "__main__":
    run_import()