"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { getOrCreateAnonymousUserId } from "../lib/anonymous-user";
import type { Card, Project } from "../lib/project-store";

const moods = ["Sunny & playful", "Cozy & curious", "Dreamy & magical", "Brave & adventurous"];
const csvHeaders = ["number", "title", "description", "image_description_for_llm_generation"];
const csvTemplateRows = [
  ["01", "Flower", "A Flower quite helpful", ""],
  ["02", "Lizard", "A living bridge that sways across the creek.", ""],
  ["03", "Turtle", "Defensive warrior with a hard shell", ""],
  ["04", "Butterfly", "Brew a helpful gust of wind.", ""],
  ["05", "Rat", "A gentle guardian blocks the river ford.", ""],
  ["06", "Mouse", "Trade it for a favour at the forest market.", ""],
  ["07", "Dog", "Deliver a secret message before sunset.", "A speedy dog, with a sword."],
  ["08", "Draw Card", "Draw 2 cards.", "A magician with cards, casting a spell of luck and fortune, fantasy card art."],
  ["09", "Well", "Discard the card of opponent", "A mysterious well dark forest"],
  ["10", "Boss", "The legendary boss at the end of the trail.", "The ultimate boss, grim and powerful, with a dark aura, fantasy card art."],
];

type CsvCard = { number: number; title: string; description: string; imageDescription: string };
type BulkImage = { file: File; number: number | null };
type GenerationJob = { id: string; status: "queued" | "running" | "completed" | "failed"; error_message: string | null; results: { card_id: string; title: string; status: "supplied" | "generated" | "failed"; storage_key: string | null; error_message: string | null }[] };

function parseCsv(text: string) {
  const rows: string[][] = [[]];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === "," && !quoted) { rows.at(-1)?.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      rows.at(-1)?.push(value); rows.push([]); value = "";
    } else value += character;
  }
  rows.at(-1)?.push(value);
  return rows.filter((row) => row.some((cell) => cell.trim()));
}

function escapeCsv(value: string | number) { return `"${String(value).replaceAll('"', '""')}"`; }

async function api<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-boardgame-card-studio-user-id": getOrCreateAnonymousUserId(), ...init.headers },
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
  const [csvCards, setCsvCards] = useState<CsvCard[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [bulkImages, setBulkImages] = useState<BulkImage[]>([]);
  const [generationJob, setGenerationJob] = useState<GenerationJob | null>(null);

  const allCards = useMemo(() => project?.collections.flatMap((collection) => collection.cards) ?? [], [project]);
  const selectedCard = allCards.find((card) => card.id === selectedCardId) ?? null;
  const matchedBulkImages = bulkImages.filter((image) => image.number !== null && allCards.some((card) => card.position === image.number));

  useEffect(() => { void loadProjects(); }, []);
  useEffect(() => { if (project && step === 5) void loadGenerationJob(); }, [project?.id, step]);

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

  function downloadCsvTemplate() {
    const content = [csvHeaders, ...csvTemplateRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    link.download = "boardgame-studio-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function readCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setCsvCards([]); setCsvErrors([]);
    if (!file) return;
    const rows = parseCsv(await file.text());
    const errors: string[] = [];
    const header = rows.shift()?.map((cell) => cell.trim().toLowerCase()) ?? [];
    if (header.join(",") !== csvHeaders.join(",")) errors.push(`The header must be: ${csvHeaders.join(", ")}.`);
    const numbers = new Set<number>();
    const validCards: CsvCard[] = [];
    rows.forEach((row, index) => {
      const line = index + 2;
      const [numberText = "", title = "", description = "", imageDescription = ""] = row.map((cell) => cell.trim());
      const number = Number(numberText);
      if (row.length !== 4) errors.push(`Row ${line}: expected 4 columns.`);
      else if (!Number.isInteger(number) || number < 1) errors.push(`Row ${line}: number must be a positive whole number.`);
      else if (numbers.has(number)) errors.push(`Row ${line}: number ${number} is duplicated.`);
      else if (!title || !description) errors.push(`Row ${line}: title and description are required.`);
      else { numbers.add(number); validCards.push({ number, title, description, imageDescription }); }
    });
    if (!rows.length) errors.push("The CSV does not contain any card rows.");
    if (rows.length > 500) errors.push("A CSV can contain at most 500 cards.");
    setCsvErrors(errors); setCsvCards(errors.length ? [] : validCards); event.target.value = "";
  }

  async function importCsvCards() {
    if (!project || !csvCards.length) return;
    try {
      setSaving(true);
      const result = await api<{ imported: number }>(`/api/projects/${project.id}/cards/import`, { method: "POST", body: JSON.stringify({ cards: csvCards }) });
      const refreshed = await api<Project>(`/api/projects/${project.id}`);
      setProject(refreshed); setProjects((current) => current.map((item) => item.id === refreshed.id ? refreshed : item));
      setSelectedCardId(refreshed.collections[0]?.cards[0]?.id ?? null); setCsvCards([]); setMessage(`${result.imported} cards imported`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to import cards."); }
    finally { setSaving(false); }
  }

  function selectBulkImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 20) { setMessage("Choose a maximum of 20 images at a time."); setBulkImages([]); return; }
    const supported = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (files.some((file) => !supported.has(file.type) || file.size > 10 * 1024 * 1024)) { setMessage("Use JPEG, PNG, WebP, or GIF files up to 10 MB each."); setBulkImages([]); return; }
    setBulkImages(files.map((file) => {
      const match = file.name.match(/^(\d+)\.(jpg|jpeg|png|webp|gif)$/i);
      return { file, number: match ? Number(match[1]) : null };
    }));
    event.target.value = "";
  }

  async function uploadBulkImages() {
    if (!project || !bulkImages.length) return;
    try {
      setSaving(true);
      const { uploads } = await api<{ uploads: { index: number; key: string; uploadUrl: string; cardId: string | null }[] }>(`/api/projects/${project.id}/assets/uploads`, {
        method: "POST", body: JSON.stringify({ files: bulkImages.map(({ file, number }) => ({ name: file.name, contentType: file.type, size: file.size, number })) }),
      });
      await Promise.all(uploads.map(async (upload) => {
        const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": bulkImages[upload.index].file.type }, body: bulkImages[upload.index].file });
        if (!response.ok) throw new Error("S3 rejected one or more image uploads. Check the bucket CORS policy.");
      }));
      const completed = uploads.map((upload) => ({ key: upload.key, cardId: upload.cardId, originalFilename: bulkImages[upload.index].file.name }));
      const result = await api<{ saved: number }>(`/api/projects/${project.id}/assets/complete`, { method: "POST", body: JSON.stringify({ assets: completed }) });
      const refreshed = await api<Project>(`/api/projects/${project.id}`);
      setProject(refreshed); setProjects((current) => current.map((item) => item.id === refreshed.id ? refreshed : item)); setBulkImages([]); setMessage(`${result.saved} images uploaded`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to upload images."); }
    finally { setSaving(false); }
  }

  async function loadGenerationJob() {
    if (!project) return;
    try { setGenerationJob(await api<GenerationJob | null>(`/api/projects/${project.id}/generation-jobs`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load generation results."); }
  }

  async function startGeneration() {
    if (!project) return;
    try { setSaving(true); setGenerationJob(await api<GenerationJob>(`/api/projects/${project.id}/generation-jobs`, { method: "POST", body: "{}" })); setMessage("Artwork generation completed."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start generation."); }
    finally { setSaving(false); }
  }

  async function downloadResult(title: string, key: string) {
    try {
      const response = await fetch(imageUrl(key)); if (!response.ok) throw new Error("Unable to download image.");
      const link = document.createElement("a"); link.href = URL.createObjectURL(await response.blob()); link.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`; link.click(); URL.revokeObjectURL(link.href);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to download image."); }
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
    <nav className="topbar"><button className="brand" onClick={() => setView("projects")}><span>*</span> boardgame card studio</button><div className="navlinks"><button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}>My projects</button><button className="avatar" aria-label="Anonymous user">M</button></div></nav>
    {message && <div className="notice" role="status">{message}<button onClick={() => setMessage("")}>x</button></div>}
    {view === "projects" ? <>
      <section className="hero"><div className="hero-copy"><p className="eyebrow">MAKE A LITTLE MAGIC</p><h1>Bring your game<br /><em>to life.</em></h1><p className="lede">Create, illustrate and save print-ready cards for the game living in your imagination.</p><button className="primary" disabled={saving} onClick={() => void createProject()}>Start a new project <b>-&gt;</b></button></div><div className="hero-art" aria-hidden="true"><div className="cloud c1" /><div className="cloud c2" /><div className="sun">*</div><div className="hill h1" /><div className="hill h2" /><div className="tree t1">+</div><div className="tree t2">+</div></div></section>
      <section className="projects"><div className="section-heading"><div><p className="eyebrow">YOUR CREATIONS</p><h2>My projects <span>{projects.length}</span></h2></div><button className="text-button" onClick={() => void createProject()}>+ New project</button></div>
        {loading ? <p className="empty-state">Loading your projects...</p> : projects.length ? <div className="project-list">{projects.map((item) => <article className="project-card" key={item.id}><div className="project-picture"><span>{item.collections.reduce((total, collection) => total + collection.cards.length, 0)}</span><small>cards</small></div><div className="project-info"><p className="eyebrow">{item.status} · {item.collections.reduce((total, collection) => total + collection.cards.length, 0)} CARDS</p><h3>{item.name}</h3><p>{item.description || "Add a story for this project in step one."}</p><div><button className="secondary" onClick={() => openProject(item)}>Open project</button><button className="delete-button" onClick={() => void deleteProject(item.id)}>Delete</button></div></div></article>)}</div> : <p className="empty-state">No projects yet. Start a new garden to save your first card collection.</p>}</section>
    </> : project && <>
      <div className="workspace-header"><button className="back" onClick={() => setView("projects")}>← Projects</button><div><strong>{project.name}</strong><span> · Draft</span></div><button className="save" disabled={saving} onClick={() => void saveProject()}>{saving ? "Saving..." : "Save changes"}</button></div>
      <section className="builder"><aside className="steps"><div className="step-title">CREATE YOUR GAME</div>{["Your project", "Theme & feeling", "Import cards", "Upload artwork", "Export"].map((name, index) => <button key={name} onClick={() => setStep(index + 1)} className={step === index + 1 ? "step current" : step > index + 1 ? "step done" : "step"}><b>{step > index + 1 ? "✓" : index + 1}</b>{name}</button>)}</aside>
        <div className="editor">
          {step === 1 && <><p className="eyebrow">STEP 1 OF 4</p><h2>What are we making?</h2><p className="intro">Give your card collection a name and explain the game it belongs to.</p><label>PROJECT NAME<input value={project.name} onChange={(event) => updateProject({ name: event.target.value })} /></label><label>WHAT IS YOUR GAME ABOUT?<textarea value={project.description} onChange={(event) => updateProject({ description: event.target.value })} /></label><button className="primary" onClick={() => void saveProject(2)}>Next: choose a feeling -&gt;</button></>}
          {step === 2 && <><p className="eyebrow">STEP 2 OF 4</p><h2>Set the scene</h2><p className="intro">Choose the feeling that guides your cards&apos; colours and personality.</p><div className="moods">{moods.map((mood) => <button className={project.mood === mood ? "mood selected" : "mood"} key={mood} onClick={() => updateProject({ mood })}><strong>{mood}</strong></button>)}</div><label>YOUR OWN WORDS<input value={project.keywords.join(", ")} onChange={(event) => updateProject({ keywords: event.target.value.split(",").map((word) => word.trim()).filter(Boolean) })} /></label><button className="primary" onClick={() => void saveProject(3)}>Next: import cards -&gt;</button></>}
          {step === 3 && <><p className="eyebrow">STEP 3 OF 4</p><h2>Import your cards</h2><p className="intro">Download the template, fill in your card ideas, then upload it to add every valid row to this project.</p><section className="csv-import"><div><h3>1. Download the template</h3><p>It includes ten example cards for an imaginary forest adventure.</p><button className="secondary" onClick={downloadCsvTemplate}>Download CSV template</button></div><div><h3>2. Upload your completed file</h3><input type="file" accept=".csv,text/csv" onChange={(event) => void readCsv(event)} /></div></section><div className="csv-columns"><strong>Required columns</strong><code>number, title, description, image_description_for_llm_generation</code></div>{csvErrors.length > 0 && <section className="csv-errors" role="alert"><strong>We found {csvErrors.length} issue{csvErrors.length === 1 ? "" : "s"}:</strong><ul>{csvErrors.map((error) => <li key={error}>{error}</li>)}</ul></section>}{csvCards.length > 0 && <section className="csv-valid"><strong>{csvCards.length} cards are ready to import.</strong><p>Their titles, descriptions, order, and image-generation descriptions will be saved.</p><button className="primary" disabled={saving} onClick={() => void importCsvCards()}>{saving ? "Importing..." : `Import ${csvCards.length} cards`}</button></section>}<div className="cards-heading import-summary"><p className="intro">{allCards.length ? `${allCards.length} cards are already saved in this project.` : "No cards have been imported yet."}</p><button className="secondary" onClick={() => setStep(4)}>Next: export -&gt;</button></div></>}
          {step === 4 && <><p className="eyebrow">STEP 4 OF 5</p><h2>Upload your artwork</h2><p className="intro">Name images <code>01.png</code> or <code>01.jpg</code> to attach them to item 1. You can also upload any artwork that belongs with your game.</p><section className="bulk-upload"><label>SELECT UP TO 20 IMAGES<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => selectBulkImages(event)} /></label><p>JPEG, PNG, WebP, or GIF. Maximum 10 MB per image.</p></section>{bulkImages.length > 0 && <section className="bulk-summary"><strong>{bulkImages.length} images selected</strong><p>{matchedBulkImages.length} image{matchedBulkImages.length === 1 ? "" : "s"} will attach to a matching card number. {bulkImages.length - matchedBulkImages.length} will be saved as general project artwork.</p><ul>{bulkImages.map((image) => <li key={`${image.file.name}-${image.file.size}`}><span>{image.file.name}</span><small>{image.number !== null && allCards.some((card) => card.position === image.number) ? `matches item ${image.number}` : "general artwork"}</small></li>)}</ul><button className="primary" disabled={saving} onClick={() => void uploadBulkImages()}>{saving ? "Uploading..." : "Upload images"}</button></section>}<button className="secondary next-step" onClick={() => setStep(5)}>Next: export -&gt;</button></>}
          {step === 5 && <><p className="eyebrow">STEP 5 OF 5</p><h2>Your artwork results</h2><p className="intro">Matching uploads are kept as supplied artwork. Missing card art is generated from its card description.</p>{!generationJob ? <section className="results-empty"><h3>Ready to generate</h3><p>Start a job after adding your cards and any reference artwork.</p><button className="primary" disabled={saving} onClick={() => void startGeneration()}>{saving ? "Generating..." : "Generate missing artwork"}</button></section> : <section className="results-panel"><div className="cards-heading"><div><h3>Job {generationJob.status}</h3><p>{generationJob.results.length} card results</p></div><button className="secondary" onClick={() => void loadGenerationJob()}>Refresh results</button></div>{generationJob.error_message && <p className="job-error">{generationJob.error_message}</p>}<div className="results-grid">{generationJob.results.map((result) => <article className="result-card" key={result.card_id}>{result.storage_key ? <img src={imageUrl(result.storage_key)} alt={`Artwork for ${result.title}`} /> : <div className="result-missing">{result.status === "failed" ? "Failed" : "Waiting"}</div>}<div><small>{result.status}</small><strong>{result.title}</strong>{result.error_message && <p>{result.error_message}</p>}{result.storage_key && <button className="text-button" onClick={() => void downloadResult(result.title, result.storage_key!)}>Download image</button>}</div></article>)}</div></section>}<button className="secondary next-step" onClick={() => setView("projects")}>Back to my projects</button></>}
        </div>
      </section>
    </>}
  </main>;
}
