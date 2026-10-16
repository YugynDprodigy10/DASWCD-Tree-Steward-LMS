import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { PasswordSetup } from "./AccountRecovery";
import { modules as initialModules } from "../data/course";
import AdminModules from "./AdminModules";
import "./AdminWorkspace.css";

import { initialPeople, initialInvitations } from "../data/admin";
const normalizeEmail = (value) => value.trim().toLowerCase();

function ModuleChoices({ selected, onChange, modules }) {
  return (
    <fieldset className="module-choices">
      <legend>Assigned modules</legend>
      <p className="helper">
        Choose the modules this instructor will manage. You can assign more
        later.
      </p>
      {modules.map((module) => (
        <label className="checkbox-label" key={module.id}>
          <input
            type="checkbox"
            checked={selected.includes(module.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, module.id]
                  : selected.filter((id) => id !== module.id),
              )
            }
          />
          <span>
            Week {module.id}: {module.title}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function PersonForm({ person, mode, onSave, onClose, emailTaken, modules }) {
  const [name, setName] = useState(person?.name || "");
  const [email, setEmail] = useState(person?.email || "");
  const [role, setRole] = useState(person?.role || "Student");
  const [assigned, setAssigned] = useState(person?.modules || []);
  const [error, setError] = useState("");
  const invite = mode === "invite" || mode === "add";
  const directAdd = mode === "add";
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const emailOnly = mode === "email";
  return (
    <Modal
      title={
        invite
          ? directAdd
            ? "Add a sample person"
            : "Invite someone to grow."
          : emailOnly
            ? "Change email address"
            : "Role & module access"
      }
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if ((invite && !name.trim()) || !email.trim()) {
            setError("Enter a name and a valid email address.");
            return;
          }
          if ((invite || emailOnly) && emailTaken(email, person?.id)) {
            setError(
              "That email already belongs to an account or pending invitation.",
            );
            return;
          }
          if (role === "Administrator" && !emailOnly && !confirmAdmin) {
            setError("Confirm administrator access before saving.");
            return;
          }
          onSave({
            name: name.trim(),
            email: normalizeEmail(email),
            role,
            modules: role === "Instructor" ? assigned : [],
          });
        }}
      >
        <p className="muted">
          {invite
            ? directAdd ? "Add a sample person and choose their role." : "Invite someone to Tree Steward Certification and choose their role."
            : `${person.name} · ${person.role}`}
        </p>
        {(invite || emailOnly) && (
          <>
            {invite && (
              <>
                <label htmlFor="person-name">Full name</label>
                <input
                  id="person-name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </>
            )}
            <label htmlFor="person-email">Email address</label>
            <input
              id="person-email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </>
        )}
        {!emailOnly && (
          <>
            <label htmlFor="person-role">Role</label>
            <select
              id="person-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option>Student</option>
              <option>Instructor</option>
              <option>Administrator</option>
            </select>
            <p className="helper">
              Choose the access this person needs. Administrator changes are a
              frontend preview only.
            </p>
            {role === "Instructor" && (
              <ModuleChoices
                modules={modules}
                selected={assigned}
                onChange={setAssigned}
              />
            )}
          </>
        )}
        {role === "Administrator" && !emailOnly && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmAdmin}
              onChange={(event) => setConfirmAdmin(event.target.checked)}
            />
            I understand this role manages people and course settings.
          </label>
        )}
        <p className="notice">
          {emailOnly
            ? "This updates the same sample account. Its enrollment and learning history are retained. No real email address is changed."
            : invite
              ? directAdd
                ? "Adds a sample directory record only. No real account or sign-in access is created; live registration remains invitation-only."
                : "Demo only: an invitation will be added to this session. Email delivery is not connected."
              : "Access changes apply only to this sample directory. Real permissions must be enforced by the backend."}
        </p>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            {invite
              ? directAdd
                ? "Add sample person"
                : "Create sample invitation"
              : "Save sample changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminWorkspace({ brand, onExit }) {
  const [page, setPage] = useState("Overview");
  const [modules, setModules] = useState(() =>
    initialModules.map((module) => ({
      ...module,
      studentsVisible: true,
      instructorsVisible: true,
      description: "",
    })),
  );
  const [showRemoved, setShowRemoved] = useState(false);
  const [people, setPeople] = useState(initialPeople);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All roles");
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState("");
  const [activity, setActivity] = useState([]);
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [page]);
  const record = (text) => {
    setNotice(text);
    setActivity((previous) => [text, ...previous].slice(0, 8));
  };
  const emailTaken = (email, exceptId) =>
    people.some(
      (person) =>
        person.id !== exceptId &&
        normalizeEmail(person.email) === normalizeEmail(email),
    ) ||
    invitations.some(
      (invite) =>
        invite.status === "Pending" &&
        normalizeEmail(invite.email) === normalizeEmail(email),
    );
  const visiblePeople = people.filter(
    (person) =>
      (showRemoved
        ? person.status === "Removed"
        : person.status !== "Removed") &&
      (filter === "All roles" || person.role === filter) &&
      `${person.name} ${person.email}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const students = people.filter(
    (person) => person.role === "Student" && person.status !== "Removed",
  );
  function changeInvitation(invite, status) {
    if (status === "Pending" && emailTaken(invite.email)) {
      record(
        "That address already has an account or pending invitation. Resolve it before resending.",
      );
      return;
    }
    setInvitations((previous) =>
      previous.map((item) =>
        item.id === invite.id ? { ...item, status } : item,
      ),
    );
    record(
      status === "Pending"
        ? `Sample invitation renewed for ${invite.name}. No email was sent.`
        : `Sample invitation revoked for ${invite.name}.`,
    );
    setDialog(null);
  }
  function acceptInvitation(invite) {
    if (
      invite.status !== "Pending" ||
      people.some(
        (person) =>
          normalizeEmail(person.email) === normalizeEmail(invite.email),
      )
    ) {
      record(
        "This invitation cannot be accepted. Check its status and email address.",
      );
      setDialog(null);
      return;
    }
    setPeople((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        name: invite.name,
        email: invite.email,
        role: invite.role,
        modules: invite.modules,
        status: "Active",
        completed: 0,
        joined: "Joined through sample invitation",
      },
    ]);
    setInvitations((previous) =>
      previous.map((item) =>
        item.id === invite.id ? { ...item, status: "Accepted" } : item,
      ),
    );
    record(
      `${invite.name} accepted the sample invitation. No real account or password was created.`,
    );
    setDialog(null);
  }
  const titles = {
    Overview: "Class overview",
    People: "People & access",
    Invitations: "Invitations",
    Modules: "Module management",
    Progress: "Student progress",
  };
  return (
    <div className="app-shell admin-shell">
      <a className="skip-link" href="#admin-main">
        Skip to content
      </a>
      <aside className="sidebar">
        {brand}
        <div className="course-picker">
          <span className="eyebrow">ADMINISTRATOR</span>
          <div>Tree Steward Certification</div>
        </div>
        <nav aria-label="Administrator navigation">
          {[
            ["Overview", "⌂"],
            ["People", "♧"],
            ["Invitations", "✉"],
            ["Modules", "▤"],
            ["Progress", "◷"],
          ].map(([name, icon]) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              aria-current={page === name ? "page" : undefined}
              onClick={() => {
                setPage(name);
                setNotice("");
              }}
            >
              <span aria-hidden="true">{icon}</span>
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            Help your
            <br />
            community flourish.
          </p>
          <span className="user-role">Administrator sample view</span>
          <button className="text-button" onClick={onExit}>
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
            <span className="demo-badge">Admin demo</span>
            <button className="text-button mobile-signout" onClick={onExit}>
              Sign out
            </button>
          </div>
        </header>
        <main id="admin-main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">ONE CLASS · A SHARED PURPOSE</span>
              <h1 ref={heading} tabIndex={-1}>
                {titles[page]}
              </h1>
              <p className="muted">
                Manage Tree Steward Certification with care.
              </p>
            </div>
            <div className="admin-actions">
              <button
                className="secondary"
                onClick={() => setDialog({ mode: "add" })}
              >
                + Add person
              </button>
              <button
                className="primary"
                onClick={() => setDialog({ mode: "invite" })}
              >
                + Invite person
              </button>
            </div>
          </div>
          <p className="admin-demo-note">
            Sample workspace · No emails are sent or real accounts changed. All
            changes reset on refresh or sign out.
          </p>
          {notice && (
            <p className="success-message" role="status">
              {notice}
            </p>
          )}
          {page === "Overview" && (
            <>
              <section className="admin-stats" aria-label="Class overview">
                {[
                  ["Students", students.length, "People"],
                  [
                    "Instructors",
                    people.filter(
                      (person) =>
                        person.role === "Instructor" &&
                        person.status !== "Removed",
                    ).length,
                    "People",
                  ],
                  [
                    "Pending invitations",
                    invitations.filter((invite) => invite.status === "Pending")
                      .length,
                    "Invitations",
                  ],
                  ["Course modules", modules.length, "Modules"],
                ].map(([label, count, destination]) => (
                  <button
                    className="stat-card"
                    key={label}
                    onClick={() => setPage(destination)}
                  >
                    <span>{label}</span>
                    <strong>{count}</strong>
                    <small>View {label.toLowerCase()} →</small>
                  </button>
                ))}
              </section>
              <section className="admin-panel">
                <span className="eyebrow">GETTING STARTED</span>
                <h2>Bring your class together.</h2>
                <p>
                  Invite your learners, assign an instructor to each module, and
                  keep account details up to date.
                </p>
                <div className="admin-actions">
                  <button
                    className="secondary"
                    onClick={() => setPage("People")}
                  >
                    Manage people
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setPage("Modules")}
                  >
                    Assign instructors
                  </button>
                </div>
              </section>
              <section className="admin-panel">
                <h2>This session</h2>
                {activity.length ? (
                  <ul className="activity-list">
                    {activity.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">
                    Your sample account and invitation changes will appear here.
                  </p>
                )}
              </section>
            </>
          )}
          {page === "People" && (
            <>
              <div className="people-filters">
                <div>
                  <label htmlFor="people-search">Find a person</label>
                  <input
                    id="people-search"
                    type="search"
                    placeholder="Search name or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="role-filter">Role</label>
                  <select
                    id="role-filter"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option>All roles</option>
                    <option>Student</option>
                    <option>Instructor</option>
                    <option>Administrator</option>
                  </select>
                </div>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showRemoved}
                  onChange={(event) => setShowRemoved(event.target.checked)}
                />
                Show removed people
              </label>
              <p className="helper" role="status">
                {visiblePeople.length} people shown · Sample records
              </p>
              <section className="people-grid" aria-label="People">
                {visiblePeople.map((person) => (
                  <article className="person-card" key={person.id}>
                    <div className="person-heading">
                      <div className="avatar" aria-hidden="true">
                        {person.name
                          .split(" ")
                          .map((word) => word[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <h2>{person.name}</h2>
                        <p>{person.email}</p>
                      </div>
                      <span
                        className={`status-tag ${person.status.toLowerCase()}`}
                      >
                        {person.status}
                      </span>
                    </div>
                    <p>
                      <span className="type-tag assignment">{person.role}</span>
                    </p>
                    <p className="helper">
                      {person.role === "Instructor"
                        ? person.modules.length
                          ? `Assigned weeks: ${[...person.modules].sort((a, b) => a - b).join(", ")}`
                          : "No modules assigned"
                        : person.role === "Administrator"
                          ? "Manages people and course settings"
                          : `${person.completed} of ${modules.length} modules complete · Illustrative progress`}
                    </p>
                    <div className="person-actions">
                      {person.status !== "Removed" ? (
                        <>
                          <button
                            className="text-button"
                            onClick={() => setDialog({ mode: "email", person })}
                          >
                            Change email
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              setDialog({ mode: "access", person })
                            }
                          >
                            Role & modules
                          </button>
                          <button
                            className="text-button"
                            disabled={person.status !== "Active"}
                            onClick={() => setDialog({ mode: "reset", person })}
                          >
                            Password reset
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              setDialog({ mode: "status", person })
                            }
                          >
                            {person.status === "Active"
                              ? "Deactivate"
                              : "Reactivate"}
                          </button>
                          <button
                            className="text-button danger-text"
                            onClick={() =>
                              setDialog({ mode: "remove", person })
                            }
                          >
                            Remove person
                          </button>
                        </>
                      ) : (
                        <button
                          className="text-button"
                          onClick={() => {
                            setPeople((previous) =>
                              previous.map((item) =>
                                item.id === person.id
                                  ? { ...item, status: "Inactive" }
                                  : item,
                              ),
                            );
                            record(
                              `${person.name} restored as inactive. History and assignments were retained.`,
                            );
                          }}
                        >
                          Restore person
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </section>
              {!visiblePeople.length && (
                <div className="empty-state">
                  <h2>No matching people.</h2>
                  <p>Try another name or email, or clear your filters.</p>
                  <button
                    className="secondary"
                    onClick={() => {
                      setSearch("");
                      setFilter("All roles");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </>
          )}
          {page === "Invitations" && (
            <>
              <p className="muted">
                Registration is invitation-only. Preview acceptance to explore
                account setup.
              </p>
              <section className="invite-list" aria-label="Invitations">
                {invitations.map((invite) => (
                  <article className="admin-panel invite-row" key={invite.id}>
                    <div>
                      <span
                        className={`status-tag ${invite.status.toLowerCase()}`}
                      >
                        {invite.status}
                      </span>
                      <h2>{invite.name}</h2>
                      <p>{invite.email}</p>
                      <span className="helper">
                        {invite.role}
                        {invite.role === "Instructor"
                          ? ` · ${invite.modules.length} assigned modules`
                          : ""}
                      </span>
                    </div>
                    <div className="invite-actions">
                      {invite.status === "Pending" && (
                        <>
                          <button
                            className="secondary"
                            onClick={() =>
                              setDialog({ mode: "accept", invite })
                            }
                          >
                            Preview acceptance
                          </button>
                          <button
                            className="secondary"
                            onClick={() =>
                              setDialog({ mode: "deliver", invite })
                            }
                          >
                            Send invite link
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              setDialog({ mode: "revoke", invite })
                            }
                          >
                            Revoke
                          </button>
                        </>
                      )}
                      {["Expired", "Revoked"].includes(invite.status) && (
                        <button
                          className="secondary"
                          onClick={() => changeInvitation(invite, "Pending")}
                        >
                          Renew invitation
                        </button>
                      )}
                      {invite.status === "Accepted" && (
                        <span className="helper">
                          Account listed under People
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}
          {page === "Modules" && (
            <AdminModules
              modules={modules}
              people={people}
              onChange={setModules}
              onNotice={record}
              onAssign={(module) => setDialog({ mode: "assign", module })}
            />
          )}
          {page === "Progress" && (
            <section className="admin-panel">
              <h2>Student progress</h2>
              <p className="notice">
                Illustrative values only. Real module completion and grades are
                not connected.
              </p>
              {students.map((person) => (
                <div className="student-progress" key={person.id}>
                  <div>
                    <strong>{person.name}</strong>
                    <span className="helper">
                      {person.status} · {person.completed} / {modules.length}{" "}
                      modules
                    </span>
                  </div>
                  <progress
                    value={person.completed}
                    max={modules.length}
                    aria-label={`${person.name} sample module completion`}
                  />
                </div>
              ))}
            </section>
          )}
          <footer className="workspace-footer">
            <span>Steward Tree · Rooted in community.</span>
            <span>Single-class administrator prototype</span>
          </footer>
        </main>
      </div>
      {dialog && ["invite", "add", "email", "access"].includes(dialog.mode) && (
        <PersonForm
          key={`${dialog.mode}-${dialog.person?.id || "new"}`}
          mode={dialog.mode}
          person={dialog.person}
          emailTaken={emailTaken}
          modules={modules}
          onClose={() => setDialog(null)}
          onSave={(values) => {
            if (dialog.mode === "add") {
              setPeople((previous) => [
                ...previous,
                {
                  ...values,
                  id: crypto.randomUUID(),
                  status: "Active",
                  completed: 0,
                  joined: "Added to sample directory",
                },
              ]);
              setPage("People");
              setShowRemoved(false);
              setSearch("");
              setFilter("All roles");
              record(
                `${values.name} added to the sample directory. No real account was created.`,
              );
            } else if (dialog.mode === "invite") {
              setInvitations((previous) => [
                { ...values, id: crypto.randomUUID(), status: "Pending" },
                ...previous,
              ]);
              record(
                `Sample invitation created for ${values.name}. No email was sent.`,
              );
              setPage("Invitations");
            } else {
              setPeople((previous) =>
                previous.map((person) =>
                  person.id === dialog.person.id
                    ? { ...person, ...values }
                    : person,
                ),
              );
              record(
                dialog.mode === "email"
                  ? `Email updated for ${values.name}. The same account and learning history were retained.`
                  : `Sample role and module access updated for ${values.name}.`,
              );
            }
            setDialog(null);
          }}
        />
      )}
      {dialog?.mode === "deliver" && (
        <InvitationDelivery
          invite={dialog.invite}
          onClose={() => setDialog(null)}
          onSend={() => {
            record(
              `Sample invitation delivery previewed for ${dialog.invite.name}. No email was sent.`,
            );
            setDialog(null);
          }}
        />
      )}
      {dialog?.mode === "remove" && (
        <Modal
          title="Remove person from this class?"
          onClose={() => setDialog(null)}
        >
          <p>
            {dialog.person.name} will leave the active directory. Their learning
            history and saved assignments will be retained; you can restore them
            from “Show removed people”.
          </p>
          <p className="notice">
            This only changes the sample directory. No real account is deleted.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() => {
                setPeople((previous) =>
                  previous.map((person) =>
                    person.id === dialog.person.id
                      ? { ...person, status: "Removed" }
                      : person,
                  ),
                );
                record(
                  `${dialog.person.name} removed from the sample class. History retained.`,
                );
                setDialog(null);
              }}
            >
              Remove from class
            </button>
          </div>
        </Modal>
      )}
      {dialog?.mode === "accept" && (
        <Modal
          title={`Welcome, ${dialog.invite.name}.`}
          onClose={() => setDialog(null)}
        >
          <p>
            You are invited to Tree Steward Certification as a{" "}
            {dialog.invite.role.toLowerCase()}.
          </p>
          <p className="helper">{dialog.invite.email}</p>
          <PasswordSetup
            invitation
            onComplete={() => acceptInvitation(dialog.invite)}
          />
        </Modal>
      )}
      {dialog?.mode === "reset" && (
        <Modal
          title="Send a password-reset link"
          onClose={() => setDialog(null)}
        >
          <p>
            For {dialog.person.name} at <strong>{dialog.person.email}</strong>.
          </p>
          <p className="notice">
            Preview only. No email will be sent and the account password will
            not change.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() => {
                record(
                  `Sample password-reset request recorded for ${dialog.person.name}. No email was sent.`,
                );
                setDialog(null);
              }}
            >
              Preview sending reset link
            </button>
          </div>
        </Modal>
      )}
      {dialog?.mode === "status" && (
        <Modal
          title={`${dialog.person.status === "Active" ? "Deactivate" : "Reactivate"} sample account?`}
          onClose={() => setDialog(null)}
        >
          <p>
            {dialog.person.name}’s enrollment and learning history will be
            retained.{" "}
            {dialog.person.status === "Active"
              ? "Their module assignments remain saved, but they will not count as an active instructor."
              : "Their saved module assignments will become active again."}
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() => {
                const status =
                  dialog.person.status === "Active" ? "Inactive" : "Active";
                setPeople((previous) =>
                  previous.map((person) =>
                    person.id === dialog.person.id
                      ? { ...person, status }
                      : person,
                  ),
                );
                record(
                  `${dialog.person.name} is now ${status.toLowerCase()} in this sample directory.`,
                );
                setDialog(null);
              }}
            >
              Confirm sample change
            </button>
          </div>
        </Modal>
      )}
      {dialog?.mode === "revoke" && (
        <Modal
          title="Revoke sample invitation?"
          onClose={() => setDialog(null)}
        >
          <p>
            {dialog.invite.name} will no longer be able to accept this
            invitation in the demo. You can renew it later.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() => changeInvitation(dialog.invite, "Revoked")}
            >
              Revoke invitation
            </button>
          </div>
        </Modal>
      )}
      {dialog?.mode === "assign" && (
        <AssignmentDialog
          module={dialog.module}
          people={people}
          onClose={() => setDialog(null)}
          onSave={(selected) => {
            setPeople((previous) =>
              previous.map((person) =>
                person.role === "Instructor" && person.status === "Active"
                  ? {
                      ...person,
                      modules: selected.includes(person.id)
                        ? [...new Set([...person.modules, dialog.module.id])]
                        : person.modules.filter(
                            (id) => id !== dialog.module.id,
                          ),
                    }
                  : person,
              ),
            );
            record(
              `Instructor assignments updated for Week ${dialog.module.id} in this demo.`,
            );
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function AssignmentDialog({ module, people, onSave, onClose }) {
  const instructors = people.filter(
    (person) => person.role === "Instructor" && person.status === "Active",
  );
  const [selected, setSelected] = useState(
    instructors
      .filter((person) => person.modules.includes(module.id))
      .map((person) => person.id),
  );
  return (
    <Modal title={`Week ${module.id}: Assign instructors`} onClose={onClose}>
      <p>{module.title}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(selected);
        }}
      >
        <fieldset className="module-choices">
          <legend>Active instructors</legend>
          {instructors.length ? (
            instructors.map((person) => (
              <label className="checkbox-label" key={person.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(person.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, person.id]
                        : selected.filter((id) => id !== person.id),
                    )
                  }
                />
                {person.name}
              </label>
            ))
          ) : (
            <p>
              Invite an instructor or update an existing person’s role first.
            </p>
          )}
        </fieldset>
        <p className="helper">Uncheck all to leave this module unassigned.</p>
        <div className="dialog-actions">
          <button className="secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save assignments
          </button>
        </div>
      </form>
    </Modal>
  );
}

function InvitationDelivery({ invite, onClose, onSend }) {
  const [message, setMessage] = useState("");
  const link = `https://steward-tree.invalid/invite/${encodeURIComponent(invite.id)}`;
  return (
    <Modal title="Send invitation link" onClose={onClose}>
      <p>
        To <strong>{invite.email}</strong> · {invite.role}
      </p>
      <p className="notice">
        Delivery preview only. Email sending and secure invitation tokens need
        backend support. This placeholder link cannot create an account.
      </p>
      <label htmlFor="sample-invite-link">
        Sample invitation link (not usable)
      </label>
      <input id="sample-invite-link" readOnly value={link} />
      <button
        className="text-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setMessage("Sample link copied. It is not a usable invitation.");
          } catch {
            setMessage(
              "Copy was unavailable. Select the sample link above to copy it manually.",
            );
          }
        }}
      >
        Copy sample link
      </button>
      {message && <p role="status">{message}</p>}
      <div className="dialog-actions">
        <button className="secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="primary" onClick={onSend}>
          Preview sending invitation
        </button>
      </div>
    </Modal>
  );
}
