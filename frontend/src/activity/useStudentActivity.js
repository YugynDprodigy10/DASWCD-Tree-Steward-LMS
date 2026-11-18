import { useEffect } from "react";
import { recordStudentPageView } from "./service.js";
import { createVisibleTimer } from "./visibleTimer.js";

function trackedPage({ moduleId, page, quizId, detail }) {
  if (quizId) {
    return {
      moduleId,
      pageKey: `quiz:${quizId}`,
      title: "Quiz",
    };
  }
  if (detail?.id !== undefined && detail?.id !== null) {
    return {
      moduleId,
      pageKey: `content:${detail.id}`,
      title: `${detail.type}: ${detail.title}`,
    };
  }
  if (page === "My progress") {
    return {
      moduleId,
      pageKey: "navigation:my-progress",
      title: "My progress",
    };
  }
  return null;
}

export function useStudentActivity({
  user,
  role,
  preview,
  moduleId,
  page,
  quizId,
  detail,
}) {
  const pageView = trackedPage({ moduleId, page, quizId, detail });
  const trackedModuleId = pageView?.moduleId;
  const trackedPageKey = pageView?.pageKey;
  const trackedTitle = pageView?.title;

  useEffect(() => {
    if (
      !user?.getAccessTokenSilently ||
      role !== "student" ||
      preview ||
      !trackedPageKey
    ) {
      return undefined;
    }

    const currentPageView = {
      moduleId: trackedModuleId,
      pageKey: trackedPageKey,
      title: trackedTitle,
    };
    const visitId = crypto.randomUUID();
    const timer = createVisibleTimer(
      performance.now(),
      document.visibilityState === "visible",
    );
    let savedSeconds = -1;

    async function save(keepalive = false) {
      const durationSeconds = timer.seconds(performance.now());
      if (durationSeconds <= savedSeconds) return;

      try {
        await recordStudentPageView(
          user,
          { ...currentPageView, visitId, durationSeconds },
          keepalive,
        );
        savedSeconds = Math.max(savedSeconds, durationSeconds);
      } catch (error) {
        console.error("Unable to record student activity.", error);
      }
    }

    function onVisibilityChange() {
      timer.setVisible(
        document.visibilityState === "visible",
        performance.now(),
      );
      if (document.visibilityState === "hidden") void save(true);
    }
    function onPageHide() {
      timer.setVisible(false, performance.now());
      void save(true);
    }

    void save();
    const interval = window.setInterval(() => void save(), 15000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      void save(true);
    };
  }, [
    user,
    role,
    preview,
    trackedModuleId,
    trackedPageKey,
    trackedTitle,
  ]);
}
