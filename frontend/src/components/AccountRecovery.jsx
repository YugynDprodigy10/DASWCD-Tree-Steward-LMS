import { useState } from "react";

export function PasswordSetup({ invitation = false, onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (password.length < 12) {
          setError("Use at least 12 characters for this preview.");
          return;
        }
        if (password !== confirmation) {
          setError("The passwords do not match.");
          return;
        }
        setPassword("");
        setConfirmation("");
        onComplete();
      }}
    >
      <p className="notice">
        Design preview only. Use a made-up password. Nothing is sent or saved,
        and this does not grant access.
      </p>
      <label htmlFor="new-password">New password</label>
      <input
        id="new-password"
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        minLength={12}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-describedby="password-hint"
      />
      <p id="password-hint" className="helper">
        At least 12 characters. Final password rules will be agreed with the
        backend team.
      </p>
      <label htmlFor="confirm-password">Confirm password</label>
      <input
        id="confirm-password"
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        required
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) => setVisible(event.target.checked)}
        />
        Show passwords
      </label>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <button className="primary full" type="submit">
        {invitation ? "Complete sample invitation" : "Preview password update"}
      </button>
    </form>
  );
}

export default function AccountRecovery({ onBack }) {
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  return (
    <main className="recovery-page">
      <button className="text-button" onClick={onBack}>
        ← Back to sign in
      </button>
      <section className="login-card recovery-card">
        <span className="eyebrow">STEWARD TREE · ACCOUNT HELP</span>
        <h1>
          {step === "request"
            ? "Forgot your password?"
            : step === "sent"
              ? "Check your inbox."
              : step === "reset"
                ? "A fresh start."
                : "Preview complete."}
        </h1>
        {step === "request" && (
          <>
            <p className="muted">
              Enter the email associated with your account to request a reset
              link.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setStep("sent");
              }}
            >
              <label htmlFor="recovery-email">Email address</label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <p className="notice">
                Demo only: no email will be sent. Please use a sample address.
              </p>
              <button className="primary full" type="submit">
                Preview reset request
              </button>
            </form>
          </>
        )}
        {step === "sent" && (
          <>
            <p>
              If an account matches that address, the live service would send
              password-reset instructions.
            </p>
            <p className="notice">
              No email was sent. You can explore the next screen below without a
              real reset link.
            </p>
            <button className="primary full" onClick={() => setStep("reset")}>
              Preview reset screen
            </button>
            <button className="text-button" onClick={() => setStep("request")}>
              Use another email
            </button>
          </>
        )}
        {step === "reset" && (
          <PasswordSetup onComplete={() => setStep("done")} />
        )}
        {step === "done" && (
          <>
            <p role="status">
              The password form was validated. No account password was changed.
            </p>
            <button className="primary full" onClick={onBack}>
              Back to sign in
            </button>
          </>
        )}
      </section>
      <p className="recovery-note">
        Registration is invitation-only. Contact your program administrator if
        you need an invitation.
      </p>
    </main>
  );
}
