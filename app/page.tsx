"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { getOrCreateAnonymousUserId } from "../lib/anonymous-user";
import type { Card, Project } from "../lib/project-store";

const moods = ["Sunny & playful", "Cozy & curious", "Dreamy & magical", "Brave & adventurous"];

async function api<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-card-garden-user-id": getOrCreateAnonymousUserId(), ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Something went wrong.");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export default function Home() {
  const [view, setView] = useState<"projects" | "create">("projects");
  const [step, setStep] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const allCards = useMemo(() => project?.collections.flatMap((collection) => collection.cards) ?? [], [project]);
  const selectedCard = allCards.find((card) => card.id === selectedCardId) ?? null;

  useEffect(() => { void loadProjects(); }, []);

  async function loadProjects() {
    try {
      setLoading(true);
      setProjects(await api<Project[]>("/api/projects"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load projects.");
    } finally {
      setLoading(false);
    }
  }

  function updateProject(values: Partial<Project>) {
    setProject((current) => current ? { ...current, ...values } : current);
  }

  async function createProject() {
    try {
      setSaving(true);
      const created = await api<Project>("/api/projects", { method: "POST", body: JSON.stringify({}) });
      setProjects((current) => [created, ...current]);
      setProject(created);
      setSelectedCardId(null);
      setStep(1);
      setView("create");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create project.");
    } finally {
      setSaving(false);
    }
  }

  function openProject(nextProject: Project) {
    setProject(nextProject);
    setSelectedCardId(nextProject.collections[0]?.cards[0]?.id ?? null);
    setStep(1);
    setView("create");
  }

  async function saveProject(nextStep?: number) {
    if (!project) return;
    try {
      setSaving(true);
      const updated = await api<Project>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: project.name, description: project.description, mood: project.mood, keywords: project.keywords }),
      });
      setProject(updated);
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage("Saved");
      if (nextStep) setStep(nextStep);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save project.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(projectId: string) {
    if (!window.confirm("Delete this project and all of its cards?")) return;
    try {
      await api(`/api/projects/${projectId}`, { method: "DELETE" });
      setProjects((current) => current.filter((item) => item.id !== projectId));
      setProject(null);
      setView("projects");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete project.");
    }
  }

  async function addCard() {
    if (!project) return;
    try {
      const card = await api<Card>(`/api/projects/${project.id}/cards`, { method: "POST", body: JSON.stringify({}) });
      const refreshed = await api<Project>(`/api/projects/${project.id}`);
      setProject(refreshed);
      setProjects((current) => current.map((item) => item.id === refreshed.id ? refreshed : item));
      setSelectedCardId(card.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add card.");
    }
  }

  function updateSelectedCard(values: Partial<Card>) {
    if (!selectedCardId) return;
    setProject((current) => current ? {
      ...current,
      collections: current.collections.map((collection) => ({
        ...collection,
        cards: collection.cards.map((card) => card.id === selectedCardId ? { ...card, ...values } : card),
      })),
    } : current);
  }

  async function saveCard() {
    if (!project || !selectedCard) return;
    try {
      setSaving(true);
      const updated = await api<Card>(`/api/projects/${project.id}/cards/${selectedCard.id}`, { method: "PATCH", body: JSON.stringify(selectedCard) });
      updateSelectedCard(updated);
      setMessage("Card saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save card.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard() {
    if (!project || !selectedCard || !window.confirm("Delete this card?")) return;
    try {
      await api(`/api/projects/${project.id}/cards/${selectedCard.id}`, { method: "DELETE" });
      const refreshed = await api<Project>(`/api/projects/${project.id}`);
      setProject(refreshed);
      setProjects((current) => current.map((item) => item.id === refreshed.id ? refreshed : item));
      setSelectedCardId(refreshed.collections[0]?.cards[0]?.id ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete card.");
    }
  }

  async function uploadArtwork(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!project || !selectedCard || !file) return;
    try {
      setSaving(true);
      const upload = await api<{ key: string; uploadUrl: string }>("/api/uploads", {
        method: "POST", body: JSON.stringify({ projectId: project.id, cardId: selectedCard.id, fileName: file.name, contentType: file.type, size: file.size }),
      });
      const uploadResponse = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadResponse.ok) throw new Error("S3 rejected the image upload. Check the bucket CORS policy.");
      const updated = await api<Card>(`/api/projects/${project.id}/cards/${selectedCard.id}`, { method: "PATCH", body: JSON.stringify({ artworkPath: upload.key }) });
      updateSelectedCard(updated);
      setMessage("Artwork uploaded");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload artwork.");
    } finally {
      event.target.value = "";
      setSaving(false);
    }
  }

  const imageUrl = (key: string) => `/api/images?key=${encodeURIComponent(key)}&userId=${encodeURIComponent(getOrCreateAnonymousUserId())}`;

  return <main className="min-h-screen">
    <nav className="topbar"><button className="brand" onClick={() => setView("projects")}><span>*</span> card garden</button><div className="navlinks"><button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}>My projects</button><button className="avatar" aria-label="Anonymous user">M</button></div></nav>
    {message && <div className="notice" role="status">{message}<button onClick={() => setMessage("")}>x</button></div>}
    {view === "projects" ? <>
      <section className="hero"><div className="hero-copy"><p className="eyebrow">MAKE A LITTLE MAGIC</p><h1>Bring your game<br /><em>to life.</em></h1><p className="lede">Create, illustrate and save print-ready cards for the game living in your imagination.</p><button className="primary" disabled={saving} onClick={() => void createProject()}>Start a new project <b>-&gt;</b></button></div><div className="hero-art" aria-hidden="true"><div className="cloud c1" /><div className="cloud c2" /><div className="sun">*</div><div className="hill h1" /><div className="hill h2" /><div className="tree t1">+</div><div className="tree t2">+</div></div></section>
      <section className="projects"><div className="section-heading"><div><p className="eyebrow">YOUR CREATIONS</p><h2>My projects <span>{projects.length}</span></h2></div><button className="text-button" onClick={() => void createProject()}>+ New project</button></div>
        {loading ? <p className="empty-state">Loading your projects...</p> : projects.length ? <div className="project-list">{projects.map((item) => <article className="project-card" key={item.id}><div className="project-picture"><span>{item.collections.reduce((total, collection) => total + collection.cards.length, 0)}</span><small>cards</small></div><div className="project-info"><p className="eyebrow">{item.status} · {item.collections.reduce((total, collection) => total + collection.cards.length, 0)} CARDS</p><h3>{item.name}</h3><p>{item.description || "Add a story for this project in step one."}</p><div><button className="secondary" onClick={() => openProject(item)}>Open project</button><button className="delete-button" onClick={() => void deleteProject(item.id)}>Delete</button></div></div></article>)}</div> : <p className="empty-state">No projects yet. Start a new garden to save your first card collection.</p>}</section>
    </> : project && <>
      <div className="workspace-header"><button className="back" onClick={() => setView("projects")}>← Projects</button><div><strong>{project.name}</strong><span> · Draft</span></div><button className="save" disabled={saving} onClick={() => void saveProject()}>{saving ? "Saving..." : "Save changes"}</button></div>
      <section className="builder"><aside className="steps"><div className="step-title">CREATE YOUR GAME</div>{["Your project", "Theme & feeling", "Card collection", "Export"].map((name, index) => <button key={name} onClick={() => setStep(index + 1)} className={step === index + 1 ? "step current" : step > index + 1 ? "step done" : "step"}><b>{step > index + 1 ? "✓" : index + 1}</b>{name}</button>)}</aside>
        <div className="editor">
          {step === 1 && <><p className="eyebrow">STEP 1 OF 4</p><h2>What are we making?</h2><p className="intro">Give your card collection a name and explain the game it belongs to.</p><label>PROJECT NAME<input value={project.name} onChange={(event) => updateProject({ name: event.target.value })} /></label><label>WHAT IS YOUR GAME ABOUT?<textarea value={project.description} onChange={(event) => updateProject({ description: event.target.value })} /></label><button className="primary" onClick={() => void saveProject(2)}>Next: choose a feeling -&gt;</button></>}
          {step === 2 && <><p className="eyebrow">STEP 2 OF 4</p><h2>Set the scene</h2><p className="intro">Choose the feeling that guides your cards&apos; colours and personality.</p><div className="moods">{moods.map((mood) => <button className={project.mood === mood ? "mood selected" : "mood"} key={mood} onClick={() => updateProject({ mood })}><strong>{mood}</strong></button>)}</div><label>YOUR OWN WORDS<input value={project.keywords.join(", ")} onChange={(event) => updateProject({ keywords: event.target.value.split(",").map((word) => word.trim()).filter(Boolean) })} /></label><button className="primary" onClick={() => void saveProject(3)}>Next: build cards -&gt;</button></>}
          {step === 3 && <><p className="eyebrow">STEP 3 OF 4</p><div className="cards-heading"><div><h2>Your card collection</h2><p className="intro">Select any card to change its story, game effect, and artwork.</p></div><button className="secondary" onClick={() => void addCard()}>+ Add card</button></div><div className="card-grid">{allCards.map((card, index) => <button className={`game-card ${["Coral", "yellow", "blue"][index % 3]} ${selectedCardId === card.id ? "card-selected" : ""}`} key={card.id} onClick={() => setSelectedCardId(card.id)}><div className="card-art">{card.artworkPath ? <img src={imageUrl(card.artworkPath)} alt="" /> : <span>+</span>}</div><div className="card-body"><small>{card.cardType}</small><strong>{card.title}</strong><p>{card.description || "Add this card's story and game effect."}</p></div></button>)}<button className="new-card" onClick={() => void addCard()}>+<br /><span>Create a card</span></button></div>
            {selectedCard ? <section className="card-editor"><div className="cards-heading"><h3>Edit card</h3><button className="delete-button" onClick={() => void deleteCard()}>Delete card</button></div><label>CARD NAME<input value={selectedCard.title} onChange={(event) => updateSelectedCard({ title: event.target.value })} /></label><label>CARD TYPE<input value={selectedCard.cardType} onChange={(event) => updateSelectedCard({ cardType: event.target.value })} /></label><label>STORY<textarea value={selectedCard.description} onChange={(event) => updateSelectedCard({ description: event.target.value })} /></label><label>GAME EFFECT<textarea value={selectedCard.gameEffect} onChange={(event) => updateSelectedCard({ gameEffect: event.target.value })} /></label><label>ARTWORK<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void uploadArtwork(event)} /></label>{selectedCard.artworkPath && <img className="artwork-preview" src={imageUrl(selectedCard.artworkPath)} alt={`Artwork for ${selectedCard.title}`} />}<button className="primary" disabled={saving} onClick={() => void saveCard()}>{saving ? "Saving..." : "Save card"}</button></section> : <p className="empty-state">Create a card to start editing it.</p>}</>}
          {step === 4 && <><p className="eyebrow">STEP 4 OF 4</p><h2>Nearly ready to play!</h2><p className="intro">Your project and cards are saved. You have {allCards.length} cards planned for <b>{project.name}</b>.</p><div className="export-box"><h3>Your garden is growing</h3><p>Artwork is stored privately in S3 and can be used in a future print export.</p><button className="primary" onClick={() => setView("projects")}>Back to my projects</button></div></>}
        </div>
      </section>
    </>}
  </main>;
}
