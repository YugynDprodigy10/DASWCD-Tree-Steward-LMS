import { apiRequest, requestHeaders, responseError } from "../api/client.js";
import { storedLessonContent } from "./content.js";

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

export async function listMaterials(user, moduleId) {
  if (user) {
    if (!materialsApiEnabled) return [];
    return (await apiRequest(user, `/modules/${moduleId}/materials`)).materials;
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

// Proposed backend contract: one multipart request saves the file and metadata.
// Keep disabled until the backend implements authorization and durable storage.
async function uploadMaterial(user, moduleId, values, file, onProgress) {
    const headers = await requestHeaders(user);
    return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const path = values.id
      ? `/materials/${encodeURIComponent(values.id)}`
      : `/modules/${moduleId}/materials`;
    request.open(values.id ? "PATCH" : "POST", `/api${path}`);
    for (const [name, value] of Object.entries(headers))
      request.setRequestHeader(name, value);
    request.timeout = 120000;
    request.upload.onprogress = (event) =>
      onProgress(
        event.lengthComputable
          ? Math.round((event.loaded / event.total) * 100)
          : null,
      );
    request.onerror = () =>
      reject(new Error("Upload failed. Check your connection and try again."));
    request.ontimeout = () =>
      reject(new Error("Upload timed out. Check the module before retrying."));
    request.onload = () => {
      let result;
      try {
        result = JSON.parse(request.responseText);
      } catch {
        /* Handled below. */
      }
      if (request.status < 200 || request.status >= 300 || !result?.material) {
        reject(
          responseError(
            request.status,
            result?.error ||
              "Upload service unavailable. Your file has not been confirmed as saved.",
          ),
        );
      } else resolve(result.material);
    };
    const body = new FormData();
    body.append(
      "metadata",
      JSON.stringify({
        title: values.title,
        description: values.description,
        transcript: values.transcript,
        published: values.published,
      }),
    );
    if (file) body.append("file", file);
    request.send(body);
  });
}
