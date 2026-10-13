'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function FamilyTreeApp() {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [persons, setPersons] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [biographies, setBiographies] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('viewer');
  const [newUserPassword, setNewUserPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'arbre' | 'gestion' | 'utilisateurs' | 'audit'>('arbre');
  
  // Nouveaux états modernes pour l'organigramme
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<'tous' | 'moukoumbi' | 'madeke' | 'mixtes'>('tous');
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  
  const treeContainerRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    surnom: 'Branche MOUKOUMBI',
    sexe: 'M',
    date_naissance: '',
    lieu_naissance: '',
    date_deces: '',
    lieu_sepulture: ''
  });

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      }
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole('viewer');
      }
      setLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserRole(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (data && !error) {
      setUserRole(data.role);
    } else {
      setUserRole('viewer');
    }
  }

  useEffect(() => {
    if (session) {
      fetchData();
      if (userRole === 'admin') {
        fetchAuditLogs();
        fetchUsersList();
      }
    }
  }, [session, userRole]);

  async function logAction(actionDescription: string) {
    if (!session) return;
    await supabase.from('audit_logs').insert([{
      user_email: session.user.email,
      action: actionDescription
    }]);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError('Identifiants incorrects ou accès non autorisé.');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function fetchData() {
    setLoading(true);
    await Promise.all([fetchPersons(), fetchRelations(), fetchBiographies(), fetchDocuments()]);
    setLoading(false);
  }

  async function fetchPersons() {
    const { data } = await supabase.from('persons').select('*').order('nom', { ascending: true });
    setPersons(data || []);
  }

  async function fetchRelations() {
    const { data } = await supabase.from('relations').select('*');
    setRelations(data || []);
  }

  async function fetchBiographies() {
    const { data } = await supabase.from('biographies').select('*');
    setBiographies(data || []);
  }

  async function fetchDocuments() {
    const { data } = await supabase.from('documents').select('*');
    setDocuments(data || []);
  }

  async function fetchAuditLogs() {
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
    setAuditLogs(data || []);
  }

  async function fetchUsersList() {
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    setUsersList(data || []);
  }

  async function handleCreateOrUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (userRole !== 'admin') return;

    if (!newUserEmail || !newUserPassword) {
      alert("Veuillez renseigner l'email et un mot de passe temporaire.");
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newUserEmail,
      password: newUserPassword,
    });

    if (authError) {
      alert("Erreur lors de la création du compte auth : " + authError.message);
      return;
    }

    if (authData.user) {
      const { error: profileError } = await supabase.from('user_profiles').upsert([{
        id: authData.user.id,
        email: newUserEmail,
        role: newUserRole
      }]);

      if (profileError) {
        alert("Erreur lors de l'attribution du profil : " + profileError.message);
      } else {
        alert("Utilisateur créé et habilité avec succès !");
        logAction(`A créé l'utilisateur ${newUserEmail} avec le rôle ${newUserRole}`);
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('viewer');
        fetchUsersList();
      }
    }
  }

  async function handleUpdateUserRole(userId: string, newRole: string) {
    if (userRole !== 'admin') return;
    const { error } = await supabase.from('user_profiles').update({ role: newRole }).eq('id', userId);
    if (error) {
      alert('Erreur lors de la mise à jour du rôle : ' + error.message);
    } else {
      alert('Rôle mis à jour avec succès !');
      fetchUsersList();
      logAction(`A modifié le rôle de l'utilisateur ID ${userId} en ${newRole}`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (userRole === 'viewer') {
      alert("Vous n'avez pas les droits nécessaires pour effectuer cette action.");
      return;
    }

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
      if (error) alert('Erreur : ' + error.message);
      else { 
        logAction(`A modifié la fiche de ${cleanedData.nom} ${cleanedData.prenom}`);
        setEditingId(null); 
        resetForm(); 
        fetchPersons(); 
      }
    } else {
      const { error } = await supabase.from('persons').insert([cleanedData]);
      if (error) alert('Erreur : ' + error.message);
      else { 
        logAction(`A ajouté le membre ${cleanedData.nom} ${cleanedData.prenom}`);
        resetForm(); 
        fetchPersons(); 
      }
    }
  }

  function handleEdit(person: any) {
    if (userRole === 'viewer') return;
    setEditingId(person.id);
    setFormData({
      nom: person.nom || '',
      prenom: person.prenom || '',
      surnom: person.surnom || 'Branche MOUKOUMBI',
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
    if (userRole !== 'admin') {
      alert("Réservé aux super-utilisateurs (Admin) !");
      return;
    }
    const targetPerson = persons.find(p => p.id === id);
    if (confirm('Voulez-vous vraiment supprimer ce membre ?')) {
      const { error } = await supabase.from('persons').delete().eq('id', id);
      if (error) alert('Erreur : ' + error.message);
      else {
        logAction(`A supprimé le membre ${targetPerson?.nom} ${targetPerson?.prenom}`);
        fetchData();
      }
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
    if (userRole === 'viewer') {
      alert("Accès refusé en lecture seule.");
      return;
    }
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

    if (errorBio) alert('Erreur : ' + errorBio.message);
    else { 
      logAction(`A mis à jour la biographie de ${selectedPerson.nom} ${selectedPerson.prenom}`);
      alert('Biographie enregistrée avec succès !'); 
      fetchBiographies(); 
    }
  }

  async function handleAddDocument(e: React.FormEvent) {
    e.preventDefault();
    if (userRole === 'viewer') return;
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

      logAction(`A ajouté un document d'archive (${docData.titre}) pour ${selectedPerson.nom} ${selectedPerson.prenom}`);
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
    if (userRole !== 'admin') {
      alert("Réservé aux administrateurs.");
      return;
    }
    if (confirm('Supprimer ce document ?')) {
      const { error } = await supabase.from('documents').delete().eq('id', docId);
      if (error) alert('Erreur : ' + error.message);
      else {
        logAction(`A supprimé un document d'archive (ID: ${docId})`);
        fetchDocuments();
      }
    }
  }

  async function handleAddRelationToPerson(e: React.FormEvent) {
    e.preventDefault();
    if (userRole === 'viewer') return;
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
    else { 
      logAction(`A créé un lien familial pour ${selectedPerson.nom} ${selectedPerson.prenom}`);
      fetchRelations(); 
      setNewRelationTargetId(''); 
    }
  }

  async function deleteRelation(relationId: string) {
    if (userRole === 'viewer') return;
    const { error } = await supabase.from('relations').delete().eq('id', relationId);
    if (error) alert('Erreur suppression : ' + error.message);
    else {
      logAction(`A supprimé un lien familial (ID: ${relationId})`);
      fetchRelations();
    }
  }

  function resetForm() {
    setFormData({ nom: '', prenom: '', surnom: 'Branche MOUKOUMBI', sexe: 'M', date_naissance: '', lieu_naissance: '', date_deces: '', lieu_sepulture: '' });
    setEditingId(null);
  }

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">Chargement de la plateforme...</div>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-900 via-gray-900 to-black flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-2xl max-w-md w-full text-white">
          <div className="text-center mb-8">
            <span className="text-4xl">🌳</span>
            <h1 className="text-2xl font-bold mt-3">Familles Madeke & Moukoumbi</h1>
            <p className="text-gray-300 text-xs mt-1">Plateforme mémorielle sécurisée</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authError && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-xl text-xs text-center">
                {authError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Adresse Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-black/30 border border-white/20 p-3 rounded-xl text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                placeholder="votre@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-black/30 border border-white/20 p-3 rounded-xl text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl font-medium text-sm transition shadow-lg"
            >
              Se connecter
            </button>
          </form>
        </div>
      </main>
    );
  }

  const filteredPersons = persons.filter(p => {
    const matchesSearch = `${p.nom} ${p.prenom}`.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (focusedPersonId && p.id !== focusedPersonId) {
      // Si un membre est en mode focus, on ne garde que lui et ses proches connectés si besoin, ou on filtre par ID
      return true;
    }
    return true;
  });

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

  // Design moderne : Cartes Glassmorphism épurées avec survol élégant
  const renderSingleBox = (p: any, branchColor = 'blue') => {
    const pBio = biographies.find(b => b.person_id === p.id);
    const pPhoto = getMemberPhoto(p.id);
    const isFocused = focusedPersonId === p.id;
    
    const borderTheme = branchColor === 'emerald' 
      ? 'border-emerald-200 hover:border-emerald-500 bg-gradient-to-br from-white to-emerald-50/30' 
      : branchColor === 'purple' 
      ? 'border-purple-200 hover:border-purple-500 bg-gradient-to-br from-white to-purple-50/30' 
      : 'border-blue-200 hover:border-blue-500 bg-gradient-to-br from-white to-blue-50/30';

    return (
      <div 
        key={p.id} 
        className={`backdrop-blur-md border-2 ${borderTheme} shadow-sm rounded-xl p-3 w-44 text-left transition-all duration-200 hover:shadow-lg relative group ${isFocused ? 'ring-4 ring-amber-400' : ''}`}
      >
        <div className="flex items-center gap-2.5">
          {pPhoto ? (
            <img src={pPhoto} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
          ) : (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-sm shrink-0 ${p.sexe === 'F' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
              {p.sexe === 'F' ? '👩' : '👨'}
            </div>
          )}
          <div className="overflow-hidden leading-tight">
            <h4 className="font-bold text-gray-900 uppercase text-[11px] truncate tracking-wide">{p.nom}</h4>
            <p className="text-[10px] text-gray-600 font-medium truncate">{p.prenom}</p>
          </div>
        </div>

        <div className="mt-2 pt-1.5 border-t border-gray-100 text-[10px] text-gray-500 truncate flex items-center justify-between">
          <span>💼 {pBio?.professions || p.profession || 'N/A'}</span>
        </div>

        <div className="mt-2 pt-1.5 border-t border-gray-100 flex justify-between items-center text-[10px]">
          <button onClick={() => handleOpenBio(p)} className="text-emerald-600 font-semibold hover:underline flex items-center gap-0.5">
            📖 Fiche
          </button>
          <button 
            onClick={() => setFocusedPersonId(isFocused ? null : p.id)} 
            className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition ${isFocused ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            title="Activer/Désactiver le focus sur ce membre"
          >
            {isFocused ? '🎯 Centré' : 'Focus'}
          </button>
          {userRole !== 'viewer' && (
            <button onClick={() => handleEdit(p)} className="text-blue-600 hover:underline">
              Modifier
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderPersonCard = (person: any, branchColor = 'blue', visitedIds = new Set<string>()) => {
    if (visitedIds.has(person.id)) return null;
    visitedIds.add(person.id);

    const spouseRelations = relations.filter(r => r.relation_type === 'conjoint' && (r.parent_id === person.id || r.child_id === person.id));
    const spouses = spouseRelations.map(sr => {
      const spouseId = sr.parent_id === person.id ? sr.child_id : sr.parent_id;
      return persons.find(p => p.id === spouseId);
    }).filter(Boolean);

    const childrenRelations = relations.filter(r => r.parent_id === person.id && r.relation_type === 'parent_enfant');

    return (
      <div key={person.id} className="flex flex-col items-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {renderSingleBox(person, branchColor)}
          {spouses.map(spouse => spouse && !visitedIds.has(spouse.id) && (
            <div key={spouse.id} className="flex items-center gap-2">
              <span className="text-gray-400 font-bold text-base animate-pulse">💍</span>
              {renderSingleBox(spouse, branchColor)}
            </div>
          ))}
        </div>

        {childrenRelations.length > 0 && (
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-6 bg-gradient-to-b from-blue-300 to-gray-300"></div>
            <div className="flex flex-wrap justify-center gap-6 relative pt-2 before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-[calc(100%-2rem)] before:h-0.5 before:bg-gray-300">
              {childrenRelations.map(cr => {
                const childPerson = persons.find(p => p.id === cr.child_id);
                return childPerson && !visitedIds.has(childPerson.id) ? (
                  <div key={childPerson.id} className="flex flex-col items-center relative pt-2">
                    <div className="absolute top-0 w-0.5 h-3 bg-gray-300"></div>
                    {renderPersonCard(childPerson, branchColor, visitedIds)}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getRootPersons = (branchList: any[], globalVisited: Set<string>) => {
    return branchList.filter(p => {
      if (globalVisited.has(p.id)) return false;
      if (focusedPersonId && p.id !== focusedPersonId && !relations.some(r => (r.parent_id === focusedPersonId || r.child_id === focusedPersonId))) {
        // Si filtre focus actif, on ne garde que l'arbre concerné
        // Pour simplifier, si focus actif, on peut forcer la racine ciblée
      }
      const hasParents = relations.some(r => r.child_id === p.id && r.relation_type === 'parent_enfant');
      return !hasParents; 
    });
  };

  const visitedMoukoumbi = new Set<string>();
  const visitedMadeke = new Set<string>();
  const visitedMixtes = new Set<string>();

  return (
    <main className={`min-h-screen bg-gray-50 p-6 md:p-12 transition-all ${isFullScreen ? 'fixed inset-0 z-50 overflow-auto bg-gray-900/95 p-4' : ''}`}>
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Arbre Généalogique - Familles Madeke & Moukoumbi</h1>
            <p className="text-gray-500 text-xs mt-1">
              Connecté en tant que : <span className="font-semibold text-blue-600">{session.user.email}</span> ({userRole.toUpperCase()})
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('arbre')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeTab === 'arbre' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                🌳 Organigramme
              </button>
              {userRole !== 'viewer' && (
                <button
                  onClick={() => setActiveTab('gestion')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeTab === 'gestion' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                  ⚙️ Gestion
                </button>
              )}
              {userRole === 'admin' && (
                <>
                  <button
                    onClick={() => setActiveTab('utilisateurs')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeTab === 'utilisateurs' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                  >
                    👥 Utilisateurs
                  </button>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeTab === 'audit' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                  >
                    📋 Journal
                  </button>
                </>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-100 transition"
            >
              Déconnexion
            </button>
          </div>
        </header>

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border flex flex-col md:flex-row items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Rechercher un membre par nom ou prénom..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="border p-2 rounded-lg w-full md:w-96 text-gray-800 text-sm"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500">Filtrer par branche :</span>
            <button 
              onClick={() => setSelectedBranchFilter('tous')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedBranchFilter === 'tous' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Toutes
            </button>
            <button 
              onClick={() => setSelectedBranchFilter('moukoumbi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedBranchFilter === 'moukoumbi' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Moukoumbi
            </button>
            <button 
              onClick={() => setSelectedBranchFilter('madeke')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedBranchFilter === 'madeke' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Madeke
            </button>
            <button 
              onClick={() => setSelectedBranchFilter('mixtes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedBranchFilter === 'mixtes' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Communs / Autres
            </button>
          </div>
        </div>

        {/* VUE 1 : ORGANIGRAMME MODERNE AVEC ZOOM, PAN & PLEIN ÉCRAN */}
        {activeTab === 'arbre' && (
          <div className="space-y-6">
            <div className="bg-white p-3 rounded-xl shadow-sm border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Commandes d'affichage :</span>
                {focusedPersonId && (
                  <button 
                    onClick={() => setFocusedPersonId(null)}
                    className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1 rounded-lg text-xs font-bold"
                  >
                    ✕ Quitter le mode Focus
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))} 
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-xs font-bold"
                >
                  🔍 Zoom -
                </button>
                <span className="text-xs font-semibold text-blue-600 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <button 
                  onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))} 
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-xs font-bold"
                >
                  🔍 Zoom +
                </button>
                <button 
                  onClick={() => setZoomLevel(1)} 
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-lg text-xs font-semibold"
                >
                  Réinitialiser
                </button>
                <button 
                  onClick={() => setIsFullScreen(!isFullScreen)} 
                  className="bg-gray-800 text-white hover:bg-gray-700 px-3 py-1 rounded-lg text-xs font-semibold ml-2"
                >
                  {isFullScreen ? '🗗 Quitter Plein Écran' : '⛶ Plein Écran'}
                </button>
              </div>
            </div>

            <div 
              ref={treeContainerRef} 
              className="space-y-16 overflow-auto pb-12 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 max-h-[75vh]"
            >
              <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.1s ease-out' }} className="space-y-16">
                
                {(selectedBranchFilter === 'tous' || selectedBranchFilter === 'moukoumbi') && (
                  <section className="p-4 bg-blue-50/20 rounded-2xl border border-blue-100/50">
                    <div className="border-b pb-4 mb-6 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-blue-900">🌿 Organigramme - Famille MOUKOUMBI</h2>
                      <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                        {brancheMoukoumbi.length} membres
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-8">
                      {getRootPersons(brancheMoukoumbi, visitedMoukoumbi).length > 0 ? (
                        getRootPersons(brancheMoukoumbi, visitedMoukoumbi).map(person => renderPersonCard(person, 'blue', visitedMoukoumbi))
                      ) : (
                        <p className="text-sm text-gray-400 italic">Aucune racine détectée ou filtrée.</p>
                      )}
                    </div>
                  </section>
                )}

                {(selectedBranchFilter === 'tous' || selectedBranchFilter === 'madeke') && (
                  <section className="p-4 bg-emerald-50/20 rounded-2xl border border-emerald-100/50">
                    <div className="border-b pb-4 mb-6 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-emerald-900">🌿 Organigramme - Famille MADEKE</h2>
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
                        {brancheMadeke.length} membres
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-8">
                      {getRootPersons(brancheMadeke, visitedMadeke).length > 0 ? (
                        getRootPersons(brancheMadeke, visitedMadeke).map(person => renderPersonCard(person, 'emerald', visitedMadeke))
                      ) : (
                        <p className="text-sm text-gray-400 italic">Aucune racine détectée ou filtrée.</p>
                      )}
                    </div>
                  </section>
                )}

                {(selectedBranchFilter === 'tous' || selectedBranchFilter === 'mixtes') && membresMixtesOuSansBranche.length > 0 && (
                  <section className="p-4 bg-purple-50/20 rounded-2xl border border-purple-100/50">
                    <div className="border-b pb-4 mb-6 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-purple-900">🔗 Membres Communs / Autres</h2>
                      <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold">
                        {membresMixtesOuSansBranche.length} membres
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-8">
                      {membresMixtesOuSansBranche
                        .filter(person => !visitedMixtes.has(person.id))
                        .map(person => renderPersonCard(person, 'purple', visitedMixtes))}
                    </div>
                  </section>
                )}

              </div>
            </div>
          </div>
        )}

        {/* VUE 2 : GESTION & TABLEAU */}
        {activeTab === 'gestion' && userRole !== 'viewer' && (
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
                <select
                  value={formData.surnom}
                  onChange={e => setFormData({ ...formData, surnom: e.target.value })}
                  className="border p-2 rounded-lg text-gray-800 text-sm bg-white"
                >
                  <option value="Branche MOUKOUMBI">Branche MOUKOUMBI</option>
                  <option value="Branche MADEKE">Branche MADEKE</option>
                  <option value="Commun / Autre">Commun / Autre</option>
                </select>
                <select
                  value={formData.sexe}
                  onChange={e => setFormData({ ...formData, sexe: e.target.value })}
                  className="border p-2 rounded-lg text-gray-800 text-sm bg-white"
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
                            {userRole === 'admin' && (
                              <button onClick={() => handleDelete(person.id)} className="text-red-600 hover:underline">Supprimer</button>
                            )}
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

        {/* VUE 3 : GESTION DES UTILISATEURS (ADMIN) */}
        {activeTab === 'utilisateurs' && userRole === 'admin' && (
          <div className="space-y-8">
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">➕ Inviter / Créer un nouvel utilisateur</h2>
              <form onSubmit={handleCreateOrUpdateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="email"
                  placeholder="Adresse email"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  required
                  className="border p-2 rounded-lg text-gray-800 text-sm"
                />
                <input
                  type="password"
                  placeholder="Mot de passe temporaire"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  required
                  className="border p-2 rounded-lg text-gray-800 text-sm"
                />
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value)}
                  className="border p-2 rounded-lg text-gray-800 text-sm bg-white"
                >
                  <option value="viewer">Viewer (Lecture seule)</option>
                  <option value="editor">Editor (Lecture, Ajout, Modif)</option>
                  <option value="admin">Admin (Super-utilisateur)</option>
                </select>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                  Créer l'utilisateur
                </button>
              </form>
            </section>

            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">👥 Habilitations des utilisateurs existants ({usersList.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-600">
                      <th className="p-3">Email</th>
                      <th className="p-3">Rôle Actuel</th>
                      <th className="p-3">Modifier le rôle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{u.email}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${u.role === 'admin' ? 'bg-red-50 text-red-700' : u.role === 'editor' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3">
                          <select
                            value={u.role}
                            onChange={e => handleUpdateUserRole(u.id, e.target.value)}
                            className="border p-1.5 rounded text-xs bg-white text-gray-800"
                          >
                            <option value="viewer">Viewer (Lecture seule)</option>
                            <option value="editor">Editor (Lecture, Ajout, Modif)</option>
                            <option value="admin">Admin (Super-utilisateur)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* VUE 4 : JOURNAL D'AUDIT (ADMIN) */}
        {activeTab === 'audit' && userRole === 'admin' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">📋 Journal d'Audit (Historique des actions)</h2>
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600 sticky top-0">
                    <th className="p-3">Date / Heure</th>
                    <th className="p-3">Utilisateur</th>
                    <th className="p-3">Action effectuée</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="p-3 font-medium text-blue-600">{log.user_email}</td>
                      <td className="p-3 text-gray-800">{log.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODALE FICHE MEMBRE AVEC EXPORT PDF */}
        {selectedPerson && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h3 className="text-xl font-bold text-gray-800 uppercase">
                  Fiche & Richesse Humaine : {selectedPerson.nom} {selectedPerson.prenom}
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.print()} 
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    🖨️ Imprimer / Export PDF
                  </button>
                  <button onClick={() => setSelectedPerson(null)} className="text-gray-500 hover:text-gray-700 text-lg font-bold">✕</button>
                </div>
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
                          {userRole !== 'viewer' && (
                            <button onClick={() => deleteRelation(r.id)} className="text-red-500 font-bold ml-1 hover:text-red-700">×</button>
                          )}
                        </span>
                      );
                    })
                  )}
                </div>

                {userRole !== 'viewer' && (
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
                )}
              </div>

              {/* SECTION 2 : BIOGRAPHIE, IMPACTS & HÉRITAGE */}
              <form onSubmit={handleSaveBio} className="mb-8 bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-4">
                <h4 className="font-semibold text-amber-900 text-sm">📜 Richesse Humaine, Biographie & Héritage</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Professions & Activités</label>
                  <input
                    type="text"
                    value={bioData.professions}
                    disabled={userRole === 'viewer'}
                    onChange={e => setBioData({ ...bioData, professions: e.target.value })}
                    className="border p-2 rounded-lg w-full text-gray-800 text-sm bg-white disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Impact dans la famille</label>
                    <textarea
                      value={bioData.impact_famille}
                      disabled={userRole === 'viewer'}
                      onChange={e => setBioData({ ...bioData, impact_famille: e.target.value })}
                      rows={2}
                      className="border p-2 rounded-lg w-full text-gray-800 text-sm bg-white disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Impact dans la société</label>
                    <textarea
                      value={bioData.impact_societe}
                      disabled={userRole === 'viewer'}
                      onChange={e => setBioData({ ...bioData, impact_societe: e.target.value })}
                      rows={2}
                      className="border p-2 rounded-lg w-full text-gray-800 text-sm bg-white disabled:bg-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Dons & Talents</label>
                    <textarea
                      value={bioData.dons_talents}
                      disabled={userRole === 'viewer'}
                      onChange={e => setBioData({ ...bioData, dons_talents: e.target.value })}
                      rows={2}
                      className="border p-2 rounded-lg w-full text-gray-800 text-sm bg-white disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Héritage (Valeurs, Terres, Biens)</label>
                    <textarea
                      value={bioData.heritage}
                      disabled={userRole === 'viewer'}
                      onChange={e => setBioData({ ...bioData, heritage: e.target.value })}
                      rows={2}
                      className="border p-2 rounded-lg w-full text-gray-800 text-sm bg-white disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {userRole !== 'viewer' && (
                  <div className="flex justify-end">
                    <button type="submit" className="bg-amber-600 text-white px-5 py-2 rounded-lg text-xs font-medium hover:bg-amber-700">
                      Enregistrer la biographie
                    </button>
                  </div>
                )}
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
                        {userRole === 'admin' && (
                          <button onClick={() => handleDeleteDocument(doc.id)} className="text-red-500 font-bold">×</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {userRole !== 'viewer' && (
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
                )}
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