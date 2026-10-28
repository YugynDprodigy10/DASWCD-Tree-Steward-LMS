import { useEffect, useRef, useState } from "react";
import Modal from "./components/Modal";
import BlockEditor from "./components/BlockEditor";
import QuizWorkspace from "./quiz/QuizWorkspace";
import QuizCard from "./quiz/QuizCard.jsx";
import { useModuleQuizzes } from "./quiz/useModuleQuizzes";
import QuizRunner from "./quiz/QuizRunner";
import { initialBlocks, modules } from "./data/course";
import "./App.css";
import ApiStatus from "./components/ApiStatus";
import AdminWorkspace from "./components/AdminWorkspace";
import AccountRecovery from "./components/AccountRecovery";
import { useMaterials } from "./materials/useMaterials.js";
import { useRoute } from "./navigation/useRoute.js";
import { navigateRoute } from "./navigation/route.js";

function restoredDemoRole() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("steward-demo-view"));
    return saved?.expires > Date.now() &&
      ["student", "instructor", "admin"].includes(saved.role)
      ? saved.role
      : null;
  } catch {
    return null;
  }
}

function Brand() {
  return (
    <div className="brand">
      <svg viewBox="0 0 40 40" aria-hidden="true" fill="none">
        <path
          d="M20 35V18M20 26L12 20M20 22L28 16M10 23C2 18 8 10 13 11C13 2 26 2 27 10C37 9 39 23 29 25"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
      </svg>
      <span>
        steward<span className="brand-light">tree</span>
        <small>ROOTED IN LEARNING</small>
      </span>
    </div>
  );
}

function Login({ onDemo, onLogin, sessionMessage }) {
  const [recovery, setRecovery] = useState(false); //onLogin tells the app that the user has successfully logged in and provides the user data to the app.
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  //all of these const values track your email and password input

  async function submitLogin(event) {
    //When there's an email and password, this function sends a request to the backend with the email and password. If the response is successful, it calls onLogin with the user data. If there's an error, it sets the message state to display the error message.
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to sign in.");
      }

      onLogin(result.user);
    } catch (error) {
      setMessage(error.message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (recovery) return <AccountRecovery onBack={() => setRecovery(false)} />;
  return (
    <div className="login-page">
      <a className="skip-link" href="#login-main">
        Skip to sign in
      </a>
      <header>
        <Brand />
        <span className="subtle">Tree Steward Program</span>
      </header>
      <main className="login-grid">
        <section className="login-story">
          <h1>Tree Steward Certification</h1>
          <p>
            A simple space to learn, share, and grow your knowledge of desert
            tree stewardship.
          </p>
          <div className="tree-art" aria-hidden="true">
            <div className="sun" />
            <div className="canopy c1" />
            <div className="canopy c2" />
            <div className="canopy c3" />
            <div className="trunk" />
            <div className="ground" />
          </div>
        </section>
        <section className="login-card" id="login-main" tabIndex={-1}>
          <span className="eyebrow">YOUR LEARNING SPACE</span>
          <h2>Welcome back.</h2>
          {sessionMessage && (
            <p role="status" className="notice">
              {sessionMessage}
            </p>
          )}
          <p className="muted">Sign in to continue your stewardship journey.</p>
          <form onSubmit={submitLogin}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-pressed={showPassword}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="login-help">
              Prototype sign-in only. Do not use a real account password.
            </p>
            <button
              type="button"
              className="text-button"
              onClick={() => setRecovery(true)}
            >
              Forgot password?
            </button>
            <button
              className="primary full"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          {message && (
            <p className="notice" role="alert">
              {message}
            </p>
          )}
          <div className="demo-section">
            <span className="demo-label">EXPLORE THE PROTOTYPE</span>
            <p>
              Prototype accounts use test credentials. Sample announcements
              reset on refresh.
            </p>
            <div className="demo-buttons">
              <button className="secondary" onClick={() => onDemo("student")}>
                Student demo
              </button>
              <button
                className="secondary"
                onClick={() => onDemo("instructor")}
              >
                Instructor demo
              </button>
              <button className="secondary" onClick={() => onDemo("admin")}>
                Administrator demo
              </button>
            </div>
          </div>
        </section>
      </main>
      <footer className="login-footer">
        Steward Tree · Learning for a thriving desert landscape.
        <ApiStatus />
      </footer>
    </div>
  );
}

export default function App() {
  return <CourseApp />;
}

function CourseApp() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(restoredDemoRole);
  const [sessionMessage, setSessionMessage] = useState("");
  const route = useRoute();
  const { moduleId } = route;
  const preview = role === "instructor" && route.preview;
  const page =
    role === "student" && !["Home", "My progress"].includes(route.page)
      ? "Home"
      : route.page;
  const setModuleId = (moduleId) =>
    navigateRoute({ moduleId, page: "Home", quizId: null, builderId: null });
  const setPreview = (preview) => navigateRoute({ preview, page: "Home" });
  const [blocks, setBlocks] = useState(initialBlocks);
  const [editor, setEditor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [read, setRead] = useState([]);
  const [message, setMessage] = useState("");
  const quizToOpen = route.builderId;
  const setQuizToOpen = (builderId) => navigateRoute({ builderId }, true);
  useEffect(() => {
    const expire = () => {
      setUser(null);
      setRole(null);
      sessionStorage.removeItem("steward-demo-view");
      setSessionMessage(
        "Your session ended. Sign in again to continue where you left off.",
      );
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  useEffect(() => {
    const closeOverlays = () => { setEditor(null); setDetail(null); };
    window.addEventListener('popstate', closeOverlays);
    window.addEventListener('app-navigation', closeOverlays);
    return () => {
      window.removeEventListener('popstate', closeOverlays);
      window.removeEventListener('app-navigation', closeOverlays);
    };
  }, []);
  const heading = useRef(null);
  const materials = useMaterials(user, moduleId, Boolean(role));
  const isInstructor = role === "instructor" && !preview;
  const canEdit = isInstructor && moduleId === 2;
  const canEditQuiz = isInstructor && (user ? true : moduleId === 2);
  const { quizzes: moduleQuizzes, error: quizError } = useModuleQuizzes(
    user,
    moduleId,
    isInstructor,
    Boolean(role) && page === "Home" && !route.quizId,
  );
  const currentModule = modules.find((item) => item.id === moduleId);
  const materialIds = new Set(materials.items.map((item) => item.id));
  const shownBlocks = [
    ...blocks.filter((item) => !materialIds.has(item.id)),
    ...materials.items,
  ].filter(
    (item) =>
      item.type !== "Quiz" &&
      item.type !== "Final exam" &&
      item.moduleId === moduleId &&
      (isInstructor || item.published),
  );
  // Content cards and quizzes share one list, sorted by their position in the
  // module (modulePageOrder in the database). Sample cards have no position yet,
  // so they come first.
  const moduleItems = [
    ...shownBlocks.map((block, index) => ({
      key: `block-${block.id}`,
      block,
      order: block.order ?? 0,
      index,
    })),
    ...moduleQuizzes.map((quiz, index) => ({
      key: `quiz-${quiz.id}`,
      quiz,
      order: quiz.order ?? 0,
      index: shownBlocks.length + index,
    })),
  ].sort((a, b) => a.order - b.order || a.index - b.index);
  useEffect(() => {
    if (role) {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [role, page, moduleId, preview]);
  function navigate(value) {
    navigateRoute({
      page: value,
      quizId: null,
      builderId: value === "Quizzes" ? route.builderId : null,
    });
    setMessage("");
  }
  function enterView(value) {
    setRole(value);
    sessionStorage.setItem(
      "steward-demo-view",
      JSON.stringify({ role: value, expires: Date.now() + 2 * 60 * 60 * 1000 }),
    );
    setMessage("");
  }
  function enterLogin(user) {
    //takes a result from the backend and uses it to decide what to display the user based on their role type.
    const role = user.roles.includes("teacher")
      ? "instructor"
      : user.roles.includes("student")
        ? "student"
        : "administrator";
    setUser(user);
    sessionStorage.removeItem("steward-demo-view");
    setRole(role);
  }
  function leaveDemo() {
    setUser(null);
    sessionStorage.removeItem("steward-demo-view");
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("quiz-draft:")) sessionStorage.removeItem(key);
    }
    navigateRoute(
      { page: "Home", quizId: null, builderId: null, preview: false },
      true,
    );
    setRole(null);
    setEditor(null);
    setDetail(null);
    setBlocks(initialBlocks);
    setRead([]);
    setMessage("");
  }
  async function saveBlock(values, file, onProgress) {
    if (!canEdit) throw new Error("You cannot edit this module.");
    if (values.type === "Learning material") {
      await materials.save(values, file, onProgress);
      setEditor(null);
      setMessage(
        user
          ? "Learning material saved."
          : "Learning material saved in this browser.",
      );
      return;
    }
    setBlocks((previous) =>
      editor.block?.id
        ? previous.map((item) =>
            item.id === editor.block.id
              ? {
                  ...item,
                  ...values,
                  detail: item.type === values.type ? item.detail : undefined,
                }
              : item,
          )
        : [...previous, { ...values, id: crypto.randomUUID(), moduleId }],
    );
    setEditor(null);
    setMessage("Content block saved for this demo session.");
  }
  if (!role)
    return (
      <Login
        onDemo={enterView}
        onLogin={enterLogin}
        sessionMessage={
          sessionMessage ||
          (route.quizId
            ? "Sign in to open this quiz. Existing quiz drafts remain in this tab."
            : "")
        }
      />
    );
  if (route.quizId && role !== "admin" && role !== "administrator")
    return (
      <QuizRunner
        key={`${route.quizId}-${user?.id || role}-${route.preview}`}
        quizId={route.quizId}
        user={user}
        preview={role === "instructor"}
        onBack={() =>
          navigateRoute({ quizId: null, page: "Home", preview: false })
        }
      />
    );
  if (role === "admin" || role === "administrator")
    return <AdminWorkspace brand={<Brand />} onExit={leaveDemo} />;
  const navItems = isInstructor
    ? [
        ["Home", "⌂"],
        ["Create", "+"],
        ["Students", "♧"],
        ["Gradebook", "▤"],
      ]
    : [
        ["Home", "⌂"],
        ["My progress", "◷"],
      ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="course-picker">
          <span className="eyebrow">COURSE</span>
          <div>Tree Steward Certification</div>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map(([name, icon]) => (
            <button
              key={name}
              className={
                page === name || (name === "Create" && page === "Quizzes")
                  ? "nav-item active"
                  : "nav-item"
              }
              aria-current={
                page === name || (name === "Create" && page === "Quizzes")
                  ? "page"
                  : undefined
              }
              onClick={() => navigate(name)}
            >
              <span aria-hidden="true">{icon}</span>
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="user-role">
            {isInstructor ? "Instructor" : "Student"} sample view
          </span>
          <button className="text-button" onClick={leaveDemo}>
            Back to sign in →
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Tree Steward Program <span className="slash">/</span> {page}
          </span>
          <div className="topbar-actions">
            <span className="demo-badge">Demo workspace</span>
            <button className="text-button mobile-signout" onClick={leaveDemo}>
              Sign out
            </button>
          </div>
        </header>
        {preview && (
          <div className="preview-banner">
            <span>
              <strong>Student preview</strong> · Only published sample content
              is shown.
            </span>
            <button
              className="secondary"
              onClick={() => {
                setPreview(false);
              }}
            >
              Exit preview
            </button>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          <div className="module-toolbar">
            <div>
              <label htmlFor="module-select">YOUR COURSE MODULES</label>
              <select
                id="module-select"
                value={moduleId}
                onChange={(event) => {
                  setModuleId(Number(event.target.value));
                  setMessage("");
                }}
              >
                {modules.map((item) => (
                  <option key={item.id} value={item.id}>
                    Week {item.id}: {item.title}
                    {isInstructor && item.id === 2 ? " · Assigned to you" : ""}
                  </option>
                ))}
              </select>
            </div>
            {isInstructor && (
              <button
                className="secondary preview-button"
                onClick={() => {
                  setPreview(true);
                  setMessage("");
                }}
              >
                Preview as student <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
          <div className="page-heading">
            <div>
              <h1 ref={heading} tabIndex={-1}>
                {page === "Home"
                  ? `Module ${moduleId}: ${currentModule.title}`
                  : page === "Create"
                    ? "Create content"
                    : page === "Quizzes"
                      ? quizToOpen
                        ? "Quiz builder"
                        : "Create a quiz"
                      : page === "Students"
                        ? "Students"
                        : page === "Gradebook"
                          ? "Course gradebook"
                          : "Your learning progress"}
              </h1>
            </div>
            {page === "Home" && (
              <span className="week-count">
                WEEK {String(moduleId).padStart(2, "0")} / 12
              </span>
            )}
          </div>
          {isInstructor &&
            !canEdit &&
            (page === "Home" || page === "Create") && (
              <div className="notice">
                This module is read-only. You are assigned to Week 2.{" "}
                <button
                  className="text-button"
                  onClick={() => {
                    setModuleId(2);
                  }}
                >
                  Open my module →
                </button>
              </div>
            )}
          {message && (
            <p role="status" className="success-message">
              {message}
            </p>
          )}
          {page === "Quizzes" && (
            <QuizWorkspace
              key={`${moduleId}-${role}`}
              moduleId={moduleId}
              user={user}
              canEdit={canEditQuiz}
              openQuizId={quizToOpen}
              onCreated={(quiz) => setQuizToOpen(quiz.id)}
              onPreview={(quiz) => navigateRoute({ quizId: quiz.id })}
              onBack={() => navigate("Create")}
              onDone={() => navigate("Home")}
              onDeleted={(quiz) => {
                navigate("Home");
                setMessage(`Deleted the quiz “${quiz.title}”.`);
              }}
            />
          )}
          {page === "Home" && (
            <>
              {quizError && (
                <p role="alert" className="notice">
                  {quizError}
                </p>
              )}
              {materials.error && (
                <p role="alert" className="notice">
                  {materials.error}
                </p>
              )}
              <section className="content-stack" aria-label="Module content">
                {moduleItems.map(({ key, block, quiz }) =>
                  quiz ? (
                    <QuizCard
                      key={key}
                      quiz={quiz}
                      instructor={isInstructor}
                      user={user}
                      preview={preview}
                      onOpen={(item) => {
                        if (isInstructor)
                          navigateRoute({
                            builderId: item.id,
                            page: "Quizzes",
                          });
                        else navigateRoute({ quizId: item.id });
                      }}
                    />
                  ) : (
                    <article
                      key={block.id}
                      className={`content-card ${block.type.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      <div className="card-top">
                        <span
                          className={`type-tag ${block.type.toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {block.type}
                        </span>
                        {!block.published && (
                          <span className="draft-tag">
                            Draft · Hidden from students
                          </span>
                        )}
                        {canEdit && (
                          <button
                            className="text-button edit-button"
                            onClick={() => setEditor({ block })}
                            aria-label={`Edit ${block.title}`}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      <h2>
                        <button
                          className="card-title"
                          onClick={() => setDetail(block)}
                        >
                          {block.title}
                        </button>
                      </h2>
                      <p>{block.description}</p>
                      <div className="card-footer">
                        <span>
                          {block.type === "Announcement"
                            ? !isInstructor && read.includes(block.id)
                              ? "Read"
                              : "Course update"
                            : block.type === "Learning material"
                              ? block.resource?.name || "File not added yet"
                              : block.type === "Final exam"
                                ? `Multiple choice + ${block.writtenQuestions || 1} written responses`
                                : "Multiple choice"}
                        </span>
                        <button
                          className="text-button"
                          onClick={() => setDetail(block)}
                        >
                          {block.type === "Announcement"
                            ? "Read announcement"
                            : "View details"}{" "}
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </article>
                  ),
                )}
              </section>
              {moduleItems.length === 0 && (
                <section className="empty-state">
                  <span aria-hidden="true">✳</span>
                  <h2>
                    {isInstructor
                      ? "A fresh page for this week."
                      : "More learning is on its way."}
                  </h2>
                  <p>
                    {isInstructor
                      ? "There are no content blocks in this sample module yet."
                      : "There is no published content in this sample module yet. Choose another week to explore."}
                  </p>
                </section>
              )}
              {(canEdit || canEditQuiz) && (
                <button
                  className="add-block"
                  onClick={() => navigate("Create")}
                >
                  <span aria-hidden="true">+</span> Add content block
                </button>
              )}
              <div className="module-pagination">
                <button
                  className="text-button"
                  disabled={moduleId === 1}
                  onClick={() => setModuleId(moduleId - 1)}
                >
                  ← Previous module
                </button>
                <button
                  className="text-button"
                  disabled={moduleId === 12}
                  onClick={() => setModuleId(moduleId + 1)}
                >
                  Next module →
                </button>
              </div>
            </>
          )}
          {page === "Create" && (
            <section className="create-grid" aria-label="Choose what to create">
              {[
                ["Announcement", "Share an update"],
                ["Learning material", "Upload a PDF or video"],
                ["Quiz", "Multiple-choice questions"],
                ["Final exam", "End-of-course exam"],
              ].map(([type, summary]) => {
                const ready =
                  type === "Quiz"
                    ? canEditQuiz
                    : type !== "Final exam" && canEdit;
                return (
                  <button
                    className="create-card simple"
                    key={type}
                    disabled={!ready}
                    onClick={() => {
                      if (type === "Quiz") {
                        navigateRoute({
                          page: "Quizzes",
                          builderId: null,
                          quizId: null,
                        });
                      } else
                        setEditor({
                          block: {
                            type,
                            title: "",
                            description: "",
                            published: false,
                          },
                        });
                    }}
                  >
                    <h2>{type}</h2>
                    <p>{summary}</p>
                    <span className={ready ? "text-button" : "helper"}>
                      {ready
                        ? "Create →"
                        : type === "Quiz"
                          ? "Not available in this module"
                          : "Coming soon"}
                    </span>
                  </button>
                );
              })}
            </section>
          )}
          {(page === "Students" || page === "Gradebook") && (
            <section className="empty-state">
              <span aria-hidden="true">{page === "Students" ? "♧" : "▤"}</span>
              <h2>
                {page === "Students"
                  ? "Your roster will live here."
                  : "Results will appear here."}
              </h2>
              <p>
                {page === "Students"
                  ? "Student enrollment is not connected in this prototype. No real student records are displayed."
                  : "Quiz attempts and grades are not connected yet. No scores have been generated."}
              </p>
              <button className="secondary" onClick={() => navigate("Home")}>
                Back to module
              </button>
            </section>
          )}
          {page === "My progress" && (
            <section className="progress-panel">
              <h2>
                {read.length} announcement{read.length === 1 ? "" : "s"} read
              </h2>
              <p>
                Reading activity is tracked only in this demo session. It does
                not count as completing a module or earning a grade.
              </p>
              {read.length === 0 ? (
                <p className="muted">
                  Open a module announcement and select “Mark as read” to try
                  it.
                </p>
              ) : (
                <ul>
                  {blocks
                    .filter(
                      (block) => read.includes(block.id) && block.published,
                    )
                    .map((block) => (
                      <li key={block.id}>
                        {block.title}
                        <span>Week {block.moduleId}</span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          )}
          <footer className="workspace-footer">
            <span>Steward Tree · Rooted in community.</span>
            <span>
              Sample announcements reset on refresh; demo files stay in this
              browser
            </span>
          </footer>
        </main>
      </div>
      {editor && (
        <BlockEditor
          key={editor.block?.id || editor.block?.type || "new"}
          block={editor.block}
          user={user}
          onClose={() => setEditor(null)}
          onSave={saveBlock}
        />
      )}
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)}>
          <span
            className={`type-tag ${detail.type.toLowerCase().replaceAll(" ", "-")}`}
          >
            {detail.type}
          </span>
          <p className="detail-copy">{detail.description}</p>
          {detail.type === "Learning material" && (
            <div className="learning-resource">
              {detail.resource ? (
                <>
                  {detail.resource.kind === "video" && (
                    <>
                      <video
                        controls
                        preload="metadata"
                        aria-label={detail.title}
                        src={detail.resource.url}
                      />
                      <h3>Transcript</h3>
                      <p className="detail-copy">{detail.transcript}</p>
                    </>
                  )}
                  <a
                    className="primary resource-link"
                    href={detail.resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open {detail.resource.kind === "pdf" ? "PDF" : "video"} (new
                    tab)
                  </a>
                  <a
                    className="resource-link"
                    href={detail.resource.url}
                    download={detail.resource.name}
                  >
                    Download {detail.resource.name}
                  </a>
                </>
              ) : (
                <p className="notice">
                  Your instructor has not added a file yet.
                </p>
              )}
            </div>
          )}
          {detail.type === "Announcement" && !isInstructor && (
            <button
              className="primary"
              onClick={() => {
                setRead((previous) =>
                  previous.includes(detail.id)
                    ? previous
                    : [...previous, detail.id],
                );
                setDetail(null);
                setMessage(
                  "Announcement marked as read for this demo session.",
                );
              }}
            >
              Mark as read
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
