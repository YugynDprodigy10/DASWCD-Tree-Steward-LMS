import { useEffect, useState } from "react";
import { listMaterials, saveMaterial } from "./service.js";

export function useMaterials(user, moduleId, enabled) {
  const [state, setState] = useState({ items: [], error: "", moduleId: null });
  const owner = user?.id ?? "demo";
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const urls = [];
    listMaterials(user, moduleId)
      .then((items) => {
        for (const item of items) {
          if (item.resource?.url?.startsWith("blob:"))
            urls.push(item.resource.url);
        }
        if (active) setState({ items, error: "", moduleId, owner });
        else urls.forEach((url) => URL.revokeObjectURL(url));
      })
      .catch((error) => {
        if (active) setState({ items: [], error: error.message, moduleId, owner });
      });
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [user, moduleId, enabled, revision, owner]);
  async function save(values, file, onProgress) {
    const material = await saveMaterial(
      user,
      moduleId,
      values,
      file,
      onProgress,
    );
    setRevision((value) => value + 1);
    return material;
  }
  return {
    items: enabled && state.moduleId === moduleId && state.owner === owner ? state.items : [],
    error: state.error,
    save,
  };
}
