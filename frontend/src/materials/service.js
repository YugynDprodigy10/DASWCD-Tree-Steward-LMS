import { apiRequest } from "../api/client.js";
import { lessonSummary, sanitizeLessonHtml, storedLessonContent } from "./content.js";

export const materialsApiEnabled =
  import.meta.env?.VITE_MATERIALS_API_ENABLED === "true";
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
const allowedTypes = ["application/pdf", "video/mp4", "video/webm"];

export function fileError(file) {
  return !file ||
    !allowedTypes.includes(file.type) ||
    file.size <= 0 ||
    file.size > MAX_FILE_BYTES
    ? "Choose a nonempty PDF, MP4, or WebM file up to 100 MB."
    : "";
}

export function pdfError(file) {
  if (!file || file.type !== "application/pdf" || file.size <= 0 || file.size > MAX_FILE_BYTES)
    return "Choose a nonempty PDF file up to 100 MB.";
  return "";
}

// uploads one file for a module and returns its fileId
async function uploadFile(user, moduleId, file, onProgress){
  const form = await apiRequest(user,`/modules/${moduleId}/files/upload`, "POST", {
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });

  await new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", form.url);
    request.upload.onprogress = (event) => onProgress(
      event.lengthComputable
        ? Math.round((event.loaded / event.total) * 100)
        : null,
    );
    request.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300){
        resolve();
      } else {
        reject(new Error ("The file could not be uploaded. Please try again."));
      }
    };
    const body = new FormData();
    for (const [name, value] of Object.entries(form.fields)){
      body.append(name, value);
    }
    body.append("file", file);
    request.send(body);
  });
  await apiRequest(user, `/files/${form.fileId}/complete`, "POST");
  return form.fileId;
}

// turns the editor's content into the blocks the lessons API stores
// new files are uploaded to s3 first, files already in the lesson keep their fileId
async function toLessonBlocks(user, moduleId, values, file, onProgress) {
  const blocks = [];
  for (const item of values.content){
    if (item.type === "text"){
      const html = sanitizeLessonHtml(item.html);
      // skip text boxes with no words
      const text = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim();
      if (!text) continue;
      blocks.push({ type: "text", html });
    } else if (item.type === "pdf") {
      let fileId;
      if (item.file) {
        fileId = await uploadFile(user, moduleId, item.file, onProgress);
      } else {
        fileId = item.fileId;
      }
      blocks.push({ type: "pdf", fileId });
    } else if (item.type === "video") {
      let fileId;
      if (file){
        fileId = await uploadFile(user, moduleId, file, onProgress);
      } else {
        fileId = item.fileId;
      }
      blocks.push({ type: "video", fileId, transcript: values.transacript });
    }
  }
  return blocks;
}

function withStore(mode, action) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("steward-demo-materials", 1);
    open.onupgradeneeded = () =>
      open.result.createObjectStore("materials", { keyPath: "id" });
    open.onerror = () =>
      reject(new Error("Browser storage is unavailable. Please try again."));
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction("materials", mode);
      const request = action(transaction.objectStore("materials"));
      transaction.oncomplete = () => {
        database.close();
        resolve(request.result);
      };
      transaction.onabort = () => {
        database.close();
        reject(
          new Error("Could not save the file. Browser storage may be full."),
        );
      };
    };
  });
}

// reshapes a lesson from api into the material shape the module page and editor use
function fromLesson(lesson, moduleId){
  const content = lesson.content.map((block) => ({
    ...block,
    id: crypto.randomUUID(),
    name: block.fileName,
  }));
  return{
    id: lesson.lessonId, moduleId,
    type: "Learning material",
    title: lesson.title,
    published: lesson.published,
    description: lessonSummary(content),
    transcript: content.find((block) => block.type === "video")?.transcript || "", content,
  };
}

export async function listMaterials(user, moduleId) {
  if (user) {
    if (!materialsApiEnabled) return [];
    const result = await apiRequest(user, `/modules/${moduleId}/lessons`);
    return result.lessons.map((lesson) => fromLesson(lesson, moduleId));
  }
  const materials = await withStore("readonly", (store) => store.getAll());
  return materials
    .filter((material) => material.moduleId === moduleId)
    .map(({ blob, ...material }) => ({
      ...material,
      resource: material.resource
        ? { ...material.resource, blob, url: URL.createObjectURL(blob) }
        : null,
      content: material.content?.map((item) => {
        if (item.type === "pdf" && item.blob) return { ...item, url: URL.createObjectURL(item.blob) };
        if (item.type === "video" && item.resource?.blob) {
          const url = URL.createObjectURL(item.resource.blob);
          return { ...item, url, resource: { ...item.resource, url } };
        }
        return item;
      }),
    }));
}

export async function saveMaterial(user, moduleId, values, file, onProgress) {
  if (file && fileError(file)) throw new Error(fileError(file));
  if (user) {
    if (!materialsApiEnabled)
      throw new Error("Shared uploads are not connected yet.");
    return uploadMaterial(user, moduleId, values, file, onProgress);
  }
  const previous = values.id
    ? await withStore("readonly", (store) => store.get(values.id))
    : null;
  const blob = file || previous?.blob;
  const content = storedLessonContent(values.content || []).map((item) => {
    if (item.type === "pdf") {
      const pdf = item.file || item.blob;
      const error = item.file ? pdfError(item.file) : "";
      if (error) throw new Error(error);
      if (!pdf) throw new Error(`Choose the PDF again: ${item.name || "lesson file"}.`);
      return { id: item.id || crypto.randomUUID(), type: "pdf", name: item.file?.name || item.name, blob: pdf };
    }
    if (item.type === "text") return item;
    if (item.type === "video" && item.resource?.blob) return { ...item, resource: { name: item.resource.name, kind: "video", blob: item.resource.blob } };
    return item;
  });
  if (!content.some((item) => item.type === "pdf" || (item.type === "text" && item.html.replace(/<[^>]*>/g, "").trim())))
    throw new Error("Add lesson text or a PDF before saving.");
  const material = {
    ...values,
    id: values.id || crypto.randomUUID(),
    moduleId,
    type: "Learning material",
    content,
    blob: blob || null,
    resource: file || previous?.resource
      ? { name: file?.name || previous.resource.name, kind: blob.type === "application/pdf" ? "pdf" : "video" }
      : null,
  };
  await withStore("readwrite", (store) => store.put(material));
  return material;
}

// saves a signed in instructor's lesson through the lessons api
// uploads any new files first, then creates the lesson (no id yet) or updates it
async function uploadMaterial(user, moduleId, values, file, onProgress) {
  const content = await toLessonBlocks(user, moduleId, values, file, onProgress);
  const lesson = { title: values.title, published: values.published, content };
  let result;
  if (values.id) {
    result = await apiRequest(user, `/lessons/${values.id}`, "PUT", lesson);
  } else {
    result = await apiRequest(user, `/modules/${moduleId}/lessons`, "POST", lesson);
  }
  return result.lesson;
}
