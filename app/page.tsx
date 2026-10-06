'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function FamilyTreeApp() {
  const [persons, setPersons] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
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
    profession: '',
    impact_famille: '',
    impact_societe: '',
    biographie: '',
    document_url: ''
  });

  // États pour l'ajout de relations dans la modale
  const [selectedParentId, setSelectedParentId] = useState('');
  const [selectedEnfantId, setSelectedEnfantId] = useState('');
  const [selectedConjointId, setSelectedConjointId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    await Promise.all([fetchPersons(), fetchRelations()]);
    setLoading(false);
  }

  async function fetchPersons() {
    const { data, error } = await supabase
      .from('persons')
      .select('*')
      .order('nom', { ascending: true });

    if (error) console.error('Erreur chargement personnes :', error);
    else setPersons(data || []);
  }

  async function fetchRelations() {
    const { data, error } = await supabase
      .from('relations')
      .select('*');

    if (error) console.error('Erreur chargement relations :', error);
    else setRelations(data || []);
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
      const { error } = await supabase
        .from('persons')
        .update(cleanedData)
        .eq('id', editingId);

      if (error) alert('Erreur lors de la modification : ' + error.message);
      else {
        setEditingId(null);
        resetForm();
        fetchPersons();
      }
    } else {
      const { error } = await supabase
        .from('persons')
        .insert([cleanedData]);

      if (error) alert("Erreur lors de l'ajout : " + error.message);
      else {
        resetForm();
        fetchPersons();
      }
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
    setBioData({
      profession: person.profession || '',
      impact_famille: person.impact_famille || '',
      impact_societe: person.impact_societe || '',
      biographie: person.biographie || '',
      document_url: person.document_url || ''
    });
    setSelectedParentId('');
    setSelectedEnfantId('');
    setSelectedConjointId('');
  }

  async function handleSaveBio(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPerson) return;

    const { error } = await supabase
      .from('persons')
      .update(bioData)
      .eq('id', selectedPerson.id);

    if (error) {
      alert('Erreur lors de la mise à jour : ' + error.message);
    } else {
      alert('Fiche mise à jour avec succès !');
      setSelectedPerson(null);
      fetchData();
    }
  }

  // Gestion des relations
  async function addRelation(parentId: string, enfantId: string, type: 'parent_enfant' | 'conjoint') {
    if (!parentId || !enfantId) return;
    const { error } = await supabase.from('relations').insert([
      { parent_id: parentId, enfant_id: enfantId, type_relation: type }
    ]);
    if (error) alert('Erreur lors de l\'ajout du lien : ' + error.message);
    else {
      fetchRelations();
      setSelectedParentId('');
      setSelectedEnfantId('');
      setSelectedConjointId('');
    }
  }

  async function deleteRelation(relationId: string) {
    const { error } = await supabase.from('relations').delete().eq('id', relationId);
    if (error) alert('Erreur suppression lien : ' + error.message);
    else fetchRelations();
  }

  function resetForm() {
    setFormData({
      nom: '',
      prenom: '',
      surnom: '',
      sexe: 'M',
      date_naissance: '',
      lieu_naissance: '',
      date_deces: '',
      lieu_sepulture: ''
    });
    setEditingId(null);
  }

  const filteredPersons = persons.filter(p => 
    `${p.nom} ${p.prenom}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const brancheMoukoumbi = filteredPersons.filter(p => p.surnom && p.surnom.includes('Moukoumbi'));
  const brancheMadeke = filteredPersons.filter(p => p.surnom && p.surnom.includes('Madeke'));
  const autresMembres = filteredPersons.filter(p => !p.surnom || (!p.surnom.includes('Moukoumbi') && !p.surnom.includes('Madeke')));

  // Helpers pour récupérer les liens de la personne sélectionnée
  const parentsLiens = relations.filter(r => r.enfant_id === selectedPerson?.id && r.type_relation === 'parent_enfant');
  const enfantsLiens = relations.filter(r => r.parent_id === selectedPerson?.id && r.type_relation === 'parent_enfant');

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
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
              🌳 Vue Arbre Visuel
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

        {/* VUE 1 : ARBRE VISUEL */}
        {activeTab === 'arbre' && (
          <div className="space-y-10">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
              <div className="border-b pb-4 mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-blue-900">🌿 Branche Famille MOUKOUMBI</h2>
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                  {brancheMoukoumbi.length} membres
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {brancheMoukoumbi.map(person => (
                  <div key={person.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-800 uppercase text-sm">{person.nom} {person.prenom}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${person.sexe === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}`}>
                          {person.sexe}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">💼 {person.profession || 'Profession non renseignée'}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t flex justify-between items-center text-xs">
                      <button onClick={() => handleOpenBio(person)} className="text-emerald-600 font-semibold hover:underline">
                        📖 Fiche & Liens
                      </button>
                      <button onClick={() => handleEdit(person)} className="text-blue-600 hover:underline">
                        Modifier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
              <div className="border-b pb-4 mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-emerald-900">🌿 Branche Famille MADEKE</h2>
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
                  {brancheMadeke.length} membres
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {brancheMadeke.map(person => (
                  <div key={person.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-800 uppercase text-sm">{person.nom} {person.prenom}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${person.sexe === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}`}>
                          {person.sexe}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">💼 {person.profession || 'Profession non renseignée'}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t flex justify-between items-center text-xs">
                      <button onClick={() => handleOpenBio(person)} className="text-emerald-600 font-semibold hover:underline">
                        📖 Fiche & Liens
                      </button>
                      <button onClick={() => handleEdit(person)} className="text-blue-600 hover:underline">
                        Modifier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
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
                    {filteredPersons.map(person => (
                      <tr key={person.id} className="border-b hover:bg-gray-50 text-sm">
                        <td className="p-3 font-medium text-gray-800 uppercase">{person.nom} {person.prenom}</td>
                        <td className="p-3 text-gray-600">{person.surnom || '-'}</td>
                        <td className="p-3 text-gray-600">{person.profession || '-'}</td>
                        <td className="p-3 text-right space-x-2">
                          <button onClick={() => handleOpenBio(person)} className="text-emerald-600 hover:underline font-medium">Fiche</button>
                          <button onClick={() => handleEdit(person)} className="text-blue-600 hover:underline">Modifier</button>
                          <button onClick={() => handleDelete(person.id)} className="text-red-600 hover:underline">Supprimer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* MODALE FICHE MEMBRE (BIOGRAPHIE & RELATIONS) */}
        {selectedPerson && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h3 className="text-xl font-bold text-gray-800 uppercase">
                  Fiche & Liens : {selectedPerson.nom} {selectedPerson.prenom}
                </h3>
                <button onClick={() => setSelectedPerson(null)} className="text-gray-500 hover:text-gray-700 text-lg font-bold">✕</button>
              </div>

              {/* Section Liens Familiaux */}
              <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                <h4 className="font-semibold text-blue-900 text-sm">🔗 Gestion des liens familiaux</h4>
                
                {/* Parents */}
                <div>
                  <span className="text-xs font-semibold text-gray-600 block mb-1">Parents :</span>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {parentsLiens.map(l => {
                      const parent = persons.find(p => p.id === l.parent_id);
                      return parent ? (
                        <span key={l.id} className="bg-white border px-2 py-1 rounded text-xs flex items-center gap-2">
                          {parent.nom} {parent.prenom}
                          <button onClick={() => deleteRelation(l.id)} className="text-red-500 font-bold">×</button>
                        </span>
                      ) : null;
                    })}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={selectedParentId}
                      onChange={e => setSelectedParentId(e.target.value)}
                      className="border p-1 rounded text-xs flex-1 text-gray-800"
                    >
                      <option value="">Ajouter un parent...</option>
                      {persons.filter(p => p.id !== selectedPerson.id).map(p => (
                        <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => addRelation(selectedParentId, selectedPerson.id, 'parent_enfant')}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                    >
                      Lier Parent
                    </button>
                  </div>
                </div>

                {/* Enfants */}
                <div>
                  <span className="text-xs font-semibold text-gray-600 block mb-1">Enfants :</span>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {enfantsLiens.map(l => {
                      const enfant = persons.find(p => p.id === l.enfant_id);
                      return enfant ? (
                        <span key={l.id} className="bg-white border px-2 py-1 rounded text-xs flex items-center gap-2">
                          {enfant.nom} {enfant.prenom}
                          <button onClick={() => deleteRelation(l.id)} className="text-red-500 font-bold">×</button>
                        </span>
                      ) : null;
                    })}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={selectedEnfantId}
                      onChange={e => setSelectedEnfantId(e.target.value)}
                      className="border p-1 rounded text-xs flex-1 text-gray-800"
                    >
                      <option value="">Ajouter un enfant...</option>
                      {persons.filter(p => p.id !== selectedPerson.id).map(p => (
                        <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => addRelation(selectedPerson.id, selectedEnfantId, 'parent_enfant')}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                    >
                      Lier Enfant
                    </button>
                  </div>
                </div>
              </div>

              {/* Formulaire Biographie */}
              <form onSubmit={handleSaveBio} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profession / Activité</label>
                  <input
                    type="text"
                    value={bioData.profession}
                    onChange={e => setBioData({ ...bioData, profession: e.target.value })}
                    className="border p-2 rounded-lg w-full text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Impact dans la famille</label>
                  <textarea
                    value={bioData.impact_famille}
                    onChange={e => setBioData({ ...bioData, impact_famille: e.target.value })}
                    rows={2}
                    className="border p-2 rounded-lg w-full text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Impact dans la société</label>
                  <textarea
                    value={bioData.impact_societe}
                    onChange={e => setBioData({ ...bioData, impact_societe: e.target.value })}
                    rows={2}
                    className="border p-2 rounded-lg w-full text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Récit / Notes biographiques</label>
                  <textarea
                    value={bioData.biographie}
                    onChange={e => setBioData({ ...bioData, biographie: e.target.value })}
                    rows={3}
                    className="border p-2 rounded-lg w-full text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lien vers les documents / photos (URL)</label>
                  <input
                    type="text"
                    value={bioData.document_url}
                    onChange={e => setBioData({ ...bioData, document_url: e.target.value })}
                    className="border p-2 rounded-lg w-full text-gray-800 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setSelectedPerson(null)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">
                    Fermer
                  </button>
                  <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm">
                    Enregistrer la fiche
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}