'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function FamilyTreeApp() {
  const [persons, setPersons] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [biographies, setBiographies] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'arbre' | 'gestion'>('arbre');
  
  // États du formulaire principal (Ajout / Édition)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    surnom: '',
    sexe: 'M',
    date_naissance: '',
    lieu_naissance: '',
    date_deces: '',
    lieu_sepulture: ''
  });

  // État pour la modale de biographie et relations
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [bioData, setBioData] = useState({
    professions: '',
    impact_famille: '',
    impact_societe: '',
    dons_talents: '',
    heritage: ''
  });

  const [docData, setDocData] = useState({
    titre: '',
    type_document: 'photo_archive',
    date_document: '',
    description: ''
  });
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [newRelationTargetId, setNewRelationTargetId] = useState('');
  const [newRelationType, setNewRelationType] = useState<'parent_enfant' | 'conjoint'>('parent_enfant');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    await Promise.all([fetchPersons(), fetchRelations(), fetchBiographies(), fetchDocuments()]);
    setLoading(false);
  }

  async function fetchPersons() {
    const { data, error } = await supabase.from('persons').select('*').order('nom', { ascending: true });
    if (error) console.error('Erreur chargement personnes :', error);
    else setPersons(data || []);
  }

  async function fetchRelations() {
    const { data, error } = await supabase.from('relations').select('*');
    if (error) console.error('Erreur chargement relations :', error);
    else setRelations(data || []);
  }

  async function fetchBiographies() {
    const { data, error } = await supabase.from('biographies').select('*');
    if (error) console.error('Erreur chargement biographies :', error);
    else setBiographies(data || []);
  }

  async function fetchDocuments() {
    const { data, error } = await supabase.from('documents').select('*');
    if (error) console.error('Erreur chargement documents :', error);
    else setDocuments(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanedData = {
      nom: formData.nom.trim().toUpperCase(),
      prenom: formData.prenom.trim(),
      surnom: formData.surnom.trim() || null,
      sexe: formData.sexe,
      date_naissance: formData.date_naissance || null,
      lieu_naissance: formData.lieu_naissance.trim() || null,
      date_deces: formData.date_deces || null,
      lieu_sepulture: formData.lieu_sepulture.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase.from('persons').update(cleanedData).eq('id', editingId);
      if (error) alert('Erreur lors de la modification : ' + error.message);
      else { setEditingId(null); resetForm(); fetchPersons(); }
    } else {
      const { error } = await supabase.from('persons').insert([cleanedData]);
      if (error) alert("Erreur lors de l'ajout : " + error.message);
      else { resetForm(); fetchPersons(); }
    }
  }

  function handleEdit(person: any) {
    setEditingId(person.id);
    setFormData({
      nom: person.nom || '',
      prenom: person.prenom || '',
      surnom: person.surnom || '',
      sexe: person.sexe || 'M',
      date_naissance: person.date_naissance || '',
      lieu_naissance: person.lieu_naissance || '',
      date_deces: person.date_deces || '',
      lieu_sepulture: person.lieu_sepulture || ''
    });
    setActiveTab('gestion');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: string) {
    if (confirm('Voulez-vous vraiment supprimer ce membre ?')) {
      const { error } = await supabase.from('persons').delete().eq('id', id);
      if (error) alert('Erreur lors de la suppression : ' + error.message);
      else fetchData();
    }
  }

  function handleOpenBio(person: any) {
    setSelectedPerson(person);
    const existingBio = biographies.find(b => b.person_id === person.id);
    setBioData({
      professions: existingBio?.professions || person.profession || '',
      impact_famille: existingBio?.impact_famille || '',
      impact_societe: existingBio?.impact_societe || '',
      dons_talents: existingBio?.dons_talents || '',
      heritage: existingBio?.heritage || ''
    });
    setDocData({ titre: '', type_document: 'photo_archive', date_document: '', description: '' });
    setUploadingFile(null);
    setNewRelationTargetId('');
    setNewRelationType('parent_enfant');
  }

  async function handleSaveBio(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPerson) return;
    const existingBio = biographies.find(b => b.person_id === selectedPerson.id);
    const bioPayload = {
      person_id: selectedPerson.id,
      professions: bioData.professions,
      impact_famille: bioData.impact_famille,
      impact_societe: bioData.impact_societe,
      dons_talents: bioData.dons_talents,
      heritage: bioData.heritage
    };

    let errorBio = existingBio 
      ? (await supabase.from('biographies').update(bioPayload).eq('id', existingBio.id)).error 
      : (await supabase.from('biographies').insert([bioPayload])).error;

    if (errorBio) alert('Erreur lors de l’enregistrement : ' + errorBio.message);
    else { alert('Biographie enregistrée avec succès !'); fetchBiographies(); }
  }

  async function handleAddDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPerson || !docData.titre || !uploadingFile) {
      alert('Veuillez renseigner un titre et sélectionner un fichier.');
      return;
    }
    setIsUploading(true);
    try {
      const fileExt = uploadingFile.name.split('.').pop();
      const fileName = `${selectedPerson.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('archives-famille').upload(fileName, uploadingFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('archives-famille').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('documents').insert([{
        person_id: selectedPerson.id,
        titre: docData.titre,
        type_document: docData.type_document,
        file_url: publicUrlData.publicUrl,
        date_document: docData.date_document || null,
        description: docData.description || null
      }]);
      if (dbError) throw dbError;

      alert('Document archivé avec succès !');
      setDocData({ titre: '', type_document: 'photo_archive', date_document: '', description: '' });
      setUploadingFile(null);
      fetchDocuments();
    } catch (error: any) {
      alert('Erreur : ' + error.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteDocument(docId: string) {
    if (confirm('Supprimer ce document ?')) {
      const { error } = await supabase.from('documents').delete().eq('id', docId);
      if (error) alert('Erreur : ' + error.message);
      else fetchDocuments();
    }
  }

  async function handleAddRelationToPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPerson || !newRelationTargetId) return;
    let parentId = selectedPerson.id;
    let childId = newRelationTargetId;

    if (newRelationType === 'parent_enfant') {
      const sens = prompt("Tapez '1' si la personne sélectionnée est le PARENT de la cible, ou '2' si la personne sélectionnée est l'ENFANT de la cible :");
      if (sens === '1') { parentId = selectedPerson.id; childId = newRelationTargetId; }
      else if (sens === '2') { parentId = newRelationTargetId; childId = selectedPerson.id; }
      else return;
    }

    const { error } = await supabase.from('relations').insert([{ parent_id: parentId, child_id: childId, relation_type: newRelationType }]);
    if (error) alert('Erreur lien : ' + error.message);
    else { fetchRelations(); setNewRelationTargetId(''); }
  }

  async function deleteRelation(relationId: string) {
    const { error } = await supabase.from('relations').delete().eq('id', relationId);
    if (error) alert('Erreur suppression : ' + error.message);
    else fetchRelations();
  }

  function resetForm() {
    setFormData({ nom: '', prenom: '', surnom: '', sexe: 'M', date_naissance: '', lieu_naissance: '', date_deces: '', lieu_sepulture: '' });
    setEditingId(null);
  }

  const filteredPersons = persons.filter(p => `${p.nom} ${p.prenom}`.toLowerCase().includes(searchTerm.toLowerCase()));

  const brancheMoukoumbi = Array.from(new Map(filteredPersons.filter(p => p.surnom && p.surnom.toLowerCase().includes('moukoumbi') && !p.surnom.toLowerCase().includes('madeke')).map(p => [p.id, p])).values());
  const brancheMadeke = Array.from(new Map(filteredPersons.filter(p => p.surnom && p.surnom.toLowerCase().includes('madeke') && !p.surnom.toLowerCase().includes('moukoumbi')).map(p => [p.id, p])).values());
  const membresMixtesOuSansBranche = Array.from(new Map(filteredPersons.filter(p => {
    const s = (p.surnom || '').toLowerCase();
    return (s.includes('moukoumbi') && s.includes('madeke')) || (!s.includes('moukoumbi') && !s.includes('madeke'));
  }).map(p => [p.id, p])).values());

  const relationsImpliquees = relations.filter(r => r.parent_id === selectedPerson?.id || r.child_id === selectedPerson?.id);
  const documentsMembre = documents.filter(d => d.person_id === selectedPerson?.id);

  function getMemberPhoto(personId: string) {
    const docs = documents.filter(d => d.person_id === personId);
    const photoDoc = docs.find(d => d.type_document === 'photo_archive') || docs.find(d => d.file_url.match(/\.(jpeg|jpg|png|webp)$/i));
    return photoDoc ? photoDoc.file_url : null;
  }

  // Composant pour dessiner une carte individuelle de membre
  const renderSingleBox = (p: any, branchColor = 'blue') => {
    const pBio = biographies.find(b => b.person_id === p.id);
    const pPhoto = getMemberPhoto(p.id);
    const borderColor = branchColor === 'emerald' ? 'border-emerald-200 hover:border-emerald-400' : branchColor === 'purple' ? 'border-purple-200 hover:border-purple-400' : 'border-blue-200 hover:border-blue-400';

    return (
      <div key={p.id} className={`bg-white border-2 ${borderColor} shadow-sm rounded-xl p-4 w-56 text-left transition hover:shadow-md relative`}>
        <div className="flex items-center gap-3">
          {pPhoto ? (
            <img src={pPhoto} alt="" className="w-12 h-12 rounded-full object-cover border shadow-sm shrink-0" />
          ) : (
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm shrink-0 ${p.sexe === 'F' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
              {p.sexe === 'F' ? '👩' : '👨'}
            </div>
          )}
          <div className="overflow-hidden">
            <h4 className="font-bold text-gray-800 uppercase text-xs truncate">{p.nom}</h4>
            <p className="text-xs text-gray-600 font-medium truncate">{p.prenom}</p>
            <span className={`text-[9px] px-1.5 py-0.5 rounded inline-block mt-0.5 ${p.sexe === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
              {p.sexe === 'M' ? 'Masculin' : 'Féminin'}
            </span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t text-[11px] text-gray-500 space-y-0.5">
          <p className="truncate">💼 {pBio?.professions || p.profession || 'Non renseigné'}</p>
        </div>
        <div className="mt-3 pt-2 border-t flex justify-between items-center text-xs">
          <button onClick={() => handleOpenBio(p)} className="text-emerald-600 font-semibold hover:underline">
            📖 Fiche
          </button>
          <button onClick={() => handleEdit(p)} className="text-blue-600 hover:underline">
            Modifier
          </button>
        </div>
      </div>
    );
  };

  // Composant réutilisable pour afficher un membre, ses conjoints et ses enfants en cascade
  const renderPersonCard = (person: any, branchColor = 'blue') => {
    // Récupérer les conjoints de la personne
    const spouseRelations = relations.filter(r => 
      r.relation_type === 'conjoint' && 
      (r.parent_id === person.id || r.child_id === person.id)
    );
    const spouses = spouseRelations.map(sr => {
      const spouseId = sr.parent_id === person.id ? sr.child_id : sr.parent_id;
      return persons.find(p => p.id === spouseId);
    }).filter(Boolean);

    // Enfants rattachés
    const childrenRelations = relations.filter(r => r.parent_id === person.id && r.relation_type === 'parent_enfant');

    return (
      <div key={person.id} className="flex flex-col items-center">
        {/* Ligne du couple (Personne + Conjoint(s)) */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {renderSingleBox(person, branchColor)}
          {spouses.map(spouse => spouse && (
            <div key={spouse.id} className="flex items-center gap-3">
              <span className="text-gray-400 font-bold text-lg" title="Conjoint(e)">💍</span>
              {renderSingleBox(spouse, branchColor)}
            </div>
          ))}
        </div>

        {/* Affichage des enfants connectés en arborescence verticale descendante */}
        {childrenRelations.length > 0 && (
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-6 bg-gray-300"></div>
            <div className="flex flex-wrap justify-center gap-6 relative pt-2 before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-[calc(100%-4rem)] before:h-0.5 before:bg-gray-300">
              {childrenRelations.map(cr => {
                const childPerson = persons.find(p => p.id === cr.child_id);
                return childPerson ? (
                  <div key={childPerson.id} className="flex flex-col items-center relative pt-4">
                    <div className="absolute top-0 w-0.5 h-4 bg-gray-300"></div>
                    {renderPersonCard(childPerson, branchColor)}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getRootPersons = (branchList: any[]) => {
    return branchList.filter(p => {
      const hasParents = relations.some(r => r.child_id === p.id && r.relation_type === 'parent_enfant');
      return !hasParents; 
    });
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Arbre Généalogique - Familles Madeke & Moukoumbi</h1>
            <p className="text-gray-600 mt-1">Plateforme de centralisation mémorielle et historique.</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border">
            <button
              onClick={() => setActiveTab('arbre')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeTab === 'arbre' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              🌳 Organigramme Hiérarchique
            </button>
            <button
              onClick={() => setActiveTab('gestion')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeTab === 'gestion' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              ⚙️ Gestion & Tableau
            </button>
          </div>
        </header>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex items-center justify-between">
          <input
            type="text"
            placeholder="Rechercher un membre par nom ou prénom..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="border p-2 rounded-lg w-full md:w-96 text-gray-800 text-sm"
          />
          <span className="text-sm text-gray-500 font-medium ml-4 hidden md:inline">
            {filteredPersons.length} membre(s) affiché(s)
          </span>
        </div>

        {/* VUE 1 : ORGANIGRAMME HIÉRARCHIQUE */}
        {activeTab === 'arbre' && (
          <div className="space-y-16 overflow-x-auto pb-12">
            {/* Branche Moukoumbi */}
            <section className="bg-white p-8 rounded-2xl shadow-sm border border-blue-100 min-w-[700px]">
              <div className="border-b pb-4 mb-8 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-blue-900">🌿 Organigramme - Famille MOUKOUMBI</h2>
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                  {brancheMoukoumbi.length} membres
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-10">
                {getRootPersons(brancheMoukoumbi).length > 0 ? (
                  getRootPersons(brancheMoukoumbi).map(person => renderPersonCard(person, 'blue'))
                ) : (
                  <p className="text-sm text-gray-400 italic">Aucune racine détectée.</p>
                )}
              </div>
            </section>

            {/* Branche Madeke */}
            <section className="bg-white p-8 rounded-2xl shadow-sm border border-emerald-100 min-w-[700px]">
              <div className="border-b pb-4 mb-8 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-emerald-900">🌿 Organigramme - Famille MADEKE</h2>
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
                  {brancheMadeke.length} membres
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-10">
                {getRootPersons(brancheMadeke).length > 0 ? (
                  getRootPersons(brancheMadeke).map(person => renderPersonCard(person, 'emerald'))
                ) : (
                  <p className="text-sm text-gray-400 italic">Aucune racine détectée.</p>
                )}
              </div>
            </section>

            {/* Membres Communs / Autres */}
            {membresMixtesOuSansBranche.length > 0 && (
              <section className="bg-white p-8 rounded-2xl shadow-sm border border-purple-100 min-w-[700px]">
                <div className="border-b pb-4 mb-8 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-purple-900">🔗 Membres Communs / Autres</h2>
                  <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold">
                    {membresMixtesOuSansBranche.length} membres
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-10">
                  {getRootPersons(membresMixtesOuSansBranche).map(person => renderPersonCard(person, 'purple'))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* VUE 2 : GESTION & TABLEAU */}
        {activeTab === 'gestion' && (
          <div className="space-y-8">
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">
                {editingId ? "Modifier l'état civil du membre" : 'Ajouter un nouveau membre'}
              </h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Nom"
                  value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  required
                  className="border p-2 rounded-lg text-gray-800 text-sm"
                />
                <input
                  type="text"
                  placeholder="Prénom(s)"
                  value={formData.prenom}
                  onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                  required
                  className="border p-2 rounded-lg text-gray-800 text-sm"
                />
                <input
                  type="text"
                  placeholder="Surnom / Branche"
                  value={formData.surnom}
                  onChange={e => setFormData({ ...formData, surnom: e.target.value })}
                  className="border p-2 rounded-lg text-gray-800 text-sm"
                />
                <select
                  value={formData.sexe}
                  onChange={e => setFormData({ ...formData, sexe: e.target.value })}
                  className="border p-2 rounded-lg text-gray-800 text-sm"
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
                <input
                  type="date"
                  value={formData.date_naissance}
                  onChange={e => setFormData({ ...formData, date_naissance: e.target.value })}
                  className="border p-2 rounded-lg text-gray-800 text-sm"
                />
                <input
                  type="text"
                  placeholder="Lieu de naissance"
                  value={formData.lieu_naissance}
                  onChange={e => setFormData({ ...formData, lieu_naissance: e.target.value })}
                  className="border p-2 rounded-lg text-gray-800 text-sm"
                />
                <input
                  type="date"
                  value={formData.date_deces}
                  onChange={e => setFormData({ ...formData, date_deces: e.target.value })}
                  className="border p-2 rounded-lg text-gray-800 text-sm"
                />
                <input
                  type="text"
                  placeholder="Lieu de sépulture"
                  value={formData.lieu_sepulture}
                  onChange={e => setFormData({ ...formData, lieu_sepulture: e.target.value })}
                  className="border p-2 rounded-lg text-gray-800 text-sm"
                />
                <div className="md:col-span-4 flex gap-3 mt-2">
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium">
                    {editingId ? 'Mettre à jour' : 'Ajouter à la base'}
                  </button>
                  {editingId && (
                    <button type="button" onClick={resetForm} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
                      Annuler
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Tableau de gestion ({filteredPersons.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-600 text-sm">
                      <th className="p-3">Nom & Prénom</th>
                      <th className="p-3">Branche</th>
                      <th className="p-3">Profession</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPersons.map(person => {
                      const bio = biographies.find(b => b.person_id === person.id);
                      return (
                        <tr key={person.id} className="border-b hover:bg-gray-50 text-sm">
                          <td className="p-3 font-medium text-gray-800 uppercase">{person.nom} {person.prenom}</td>
                          <td className="p-3 text-gray-600">{person.surnom || '-'}</td>
                          <td className="p-3 text-gray-600">{bio?.professions || person.profession || '-'}</td>
                          <td className="p-3 text-right space-x-2">
                            <button onClick={() => handleOpenBio(person)} className="text-emerald-600 hover:underline font-medium">Fiche</button>
                            <button onClick={() => handleEdit(person)} className="text-blue-600 hover:underline">Modifier</button>
                            <button onClick={() => handleDelete(person.id)} className="text-red-600 hover:underline">Supprimer</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* MODALE FICHE MEMBRE */}
        {selectedPerson && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h3 className="text-xl font-bold text-gray-800 uppercase">
                  Fiche & Richesse Humaine : {selectedPerson.nom} {selectedPerson.prenom}
                </h3>
                <button onClick={() => setSelectedPerson(null)} className="text-gray-500 hover:text-gray-700 text-lg font-bold">✕</button>
              </div>

              {/* SECTION 1 : RELATIONS FAMILIALES */}
              <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                <h4 className="font-semibold text-blue-900 text-sm">🔗 Relations familiales</h4>
                <div className="flex flex-wrap gap-2">
                  {relationsImpliquees.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Aucune relation rattachée pour l'instant.</p>
                  ) : (
                    relationsImpliquees.map(r => {
                      const isParent = r.parent_id === selectedPerson.id;
                      const otherId = isParent ? r.child_id : r.parent_id;
                      const otherPerson = persons.find(p => p.id === otherId);
                      if (!otherPerson) return null;

                      let labelLien = r.relation_type === 'conjoint' ? '💍 Conjoint(e)' : (isParent ? '👶 Enfant' : '👤 Parent');

                      return (
                        <span key={r.id} className="bg-white border px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-sm">
                          <span className="font-semibold text-blue-800">{labelLien} :</span>
                          <span className="uppercase">{otherPerson.nom} {otherPerson.prenom}</span>
                          <button onClick={() => deleteRelation(r.id)} className="text-red-500 font-bold ml-1 hover:text-red-700">×</button>
                        </span>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleAddRelationToPerson} className="pt-3 border-t border-blue-200 flex flex-col sm:flex-row gap-2">
                  <select
                    value={newRelationTargetId}
                    onChange={e => setNewRelationTargetId(e.target.value)}
                    className="border p-2 rounded text-xs flex-1 text-gray-800 bg-white"
                  >
                    <option value="">Lier un autre membre...</option>
                    {persons.filter(p => p.id !== selectedPerson.id).map(p => (
                      <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                    ))}
                  </select>
                  <select
                    value={newRelationType}
                    onChange={e => setNewRelationType(e.target.value as any)}
                    className="border p-2 rounded text-xs text-gray-800 bg-white"
                  >
                    <option value="parent_enfant">Parent / Enfant</option>
                    <option value="conjoint">Conjoint(e)</option>
                  </select>
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-medium hover:bg-blue-700">
                    + Ajouter
                  </button>
                </form>
              </div>

              {/* SECTION 2 : BIOGRAPHIE, IMPACTS & HÉRITAGE */}
              <form onSubmit={handleSaveBio} className="mb-8 bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-4">
                <h4 className="font-semibold text-amber-900 text-sm">📜 Richesse Humaine, Biographie & Héritage</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Professions & Activités</label>
                  <input
                    type="text"
                    value={bioData.professions}
                    onChange={e => setBioData({ ...bioData, professions: e.target.value })}
                    placeholder="Ex: Enseignant, Agriculteur, Commerçant..."
                    className="border p-2 rounded-lg w-full text-gray-800 text-sm bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Impact dans la famille</label>
                    <textarea
                      value={bioData.impact_famille}
                      onChange={e => setBioData({ ...bioData, impact_famille: e.target.value })}
                      rows={2}
                      className="border p-2 rounded-lg w-full text-gray-800 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Impact dans la société</label>
                    <textarea
                      value={bioData.impact_societe}
                      onChange={e => setBioData({ ...bioData, impact_societe: e.target.value })}
                      rows={2}
                      className="border p-2 rounded-lg w-full text-gray-800 text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Dons & Talents</label>
                    <textarea
                      value={bioData.dons_talents}
                      onChange={e => setBioData({ ...bioData, dons_talents: e.target.value })}
                      rows={2}
                      className="border p-2 rounded-lg w-full text-gray-800 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Héritage (Valeurs, Terres, Biens)</label>
                    <textarea
                      value={bioData.heritage}
                      onChange={e => setBioData({ ...bioData, heritage: e.target.value })}
                      rows={2}
                      className="border p-2 rounded-lg w-full text-gray-800 text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="bg-amber-600 text-white px-5 py-2 rounded-lg text-xs font-medium hover:bg-amber-700">
                    Enregistrer la biographie
                  </button>
                </div>
              </form>

              {/* SECTION 3 : DOCUMENTS & ARCHIVES */}
              <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                <h4 className="font-semibold text-gray-800 text-sm">📁 Documents & Archives ({documentsMembre.length})</h4>
                <div className="space-y-2">
                  {documentsMembre.map(doc => (
                    <div key={doc.id} className="bg-white p-3 rounded-lg border flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-gray-800">{doc.titre}</span>
                        <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase text-[10px]">{doc.type_document}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">Ouvrir</a>
                        <button onClick={() => handleDeleteDocument(doc.id)} className="text-red-500 font-bold">×</button>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddDocument} className="pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Titre (ex: Portrait)"
                    value={docData.titre}
                    onChange={e => setDocData({ ...docData, titre: e.target.value })}
                    required
                    className="border p-2 rounded text-xs bg-white text-gray-800"
                  />
                  <select
                    value={docData.type_document}
                    onChange={e => setDocData({ ...docData, type_document: e.target.value })}
                    className="border p-2 rounded text-xs bg-white text-gray-800"
                  >
                    <option value="photo_archive">Photo d'archive</option>
                    <option value="naissance">Naissance</option>
                    <option value="mariage">Mariage</option>
                    <option value="deces">Décès</option>
                    <option value="autre">Autre</option>
                  </select>
                  
                  <div className="sm:col-span-2">
                    <input
                      type="file"
                      onChange={e => setUploadingFile(e.target.files?.[0] || null)}
                      className="border p-1.5 rounded text-xs bg-white text-gray-800 w-full"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 flex justify-end">
                    <button 
                      type="submit" 
                      disabled={isUploading}
                      className="bg-gray-700 text-white px-4 py-2 rounded text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                    >
                      {isUploading ? 'Téléversement...' : '📤 Uploader et archiver'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <button type="button" onClick={() => setSelectedPerson(null)} className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}