export const pages = [
  "Home",
  "Create",
  "Quizzes",
  "Students",
  "Gradebook",
  "Analytics",
  "My progress",
];

export function readRoute(search = window.location.search) {
  const params = new URLSearchParams(search);
  const moduleId = Number(params.get("module"));
  return {
    page: pages.includes(params.get("page")) ? params.get("page") : "Home",
    moduleId:
      Number.isInteger(moduleId) && moduleId >= 1 && moduleId <= 12
        ? moduleId
        : 2,
    quizId: params.get("quiz") || null,
    builderId: params.get("builder") || null,
    preview: params.get("preview") === "true",
  };
}

export function routeSearch(route) {
  const params = new URLSearchParams({
    module: String(route.moduleId),
    page: route.page,
  });
  if (route.quizId) params.set("quiz", route.quizId);
  if (route.builderId) params.set("builder", route.builderId);
  if (route.preview) params.set("preview", "true");
  return `?${params}`;
}

export function navigateRoute(changes, replace = false) {
  const route = { ...readRoute(), ...changes };
  window.history[replace ? "replaceState" : "pushState"](
    null,
    "",
    `${window.location.pathname}${routeSearch(route)}`,
  );
  window.dispatchEvent(new Event("app-navigation"));
}
