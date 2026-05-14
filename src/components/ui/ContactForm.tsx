import { useState } from "react";

type Step = "input" | "options" | "sent";
type OptionsPhase = "in" | "out" | null;
type SendingTarget = "email" | "notification" | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (val: string) => EMAIL_RE.test(val.trim());

interface Props {
  ntfyTopic: string;
  contactEmail: string;
  web3FormsKey: string;
}

export const ContactForm = ({ ntfyTopic, contactEmail, web3FormsKey }: Props) => {
  const [identity, setIdentity] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [step, setStep] = useState<Step>("input");
  const [optionsPhase, setOptionsPhase] = useState<OptionsPhase>(null);
  const [sendingTarget, setSendingTarget] = useState<SendingTarget>(null);
  const sending = sendingTarget !== null;
  const [status, setStatus] = useState("");
  const [emailError, setEmailError] = useState("");

  const allFilled = identity.trim() && subject.trim() && message.trim();

  const showOptions = () => {
    setStep("options");
    setOptionsPhase("in");
  };

  const hideOptions = (then?: () => void) => {
    setOptionsPhase("out");
    setTimeout(() => {
      setOptionsPhase(null);
      then?.();
    }, 320); // 200ms animation + 70ms stagger + safety margin
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFilled) return;
    showOptions();
  };

  const handleEmail = async () => {
    if (!isValidEmail(identity)) {
      setEmailError("identity must be a valid email address to use this option.");
      return;
    }
    setEmailError("");
    setSendingTarget("email");
    setStatus("");
    try {
      if (web3FormsKey) {
        const payload: Record<string, string> = {
          access_key: web3FormsKey,
          subject: subject,
          message: `${message}\n\nFrom: ${identity}`,
          from_name: identity,
        };
        if (isValidEmail(identity)) payload.email = identity;
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        hideOptions(() => setStep("sent"));
      } else {
        // Fallback: open mail client if key not configured
        const sub = encodeURIComponent(subject);
        const body = encodeURIComponent(`${message}\n\nFrom: ${identity}`);
        window.open(`mailto:${contactEmail}?subject=${sub}&body=${body}`);
        hideOptions(() => setStep("sent"));
      }
    } catch {
      setStatus("failed to send. please try notification instead.");
    } finally {
      setSendingTarget(null);
    }
  };

  const handleNtfy = async () => {
    if (!ntfyTopic) {
      setStatus("ntfy topic is not configured.");
      return;
    }
    setSendingTarget("notification");
    setStatus("");
    try {
      const res = await fetch(`https://ntfy.sh/${ntfyTopic}`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "Title": subject,
          "Tags": "envelope",
          "Priority": "default",
        },
        body: `from: ${identity}\n\n${message}`,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      hideOptions(() => setStep("sent"));
    } catch {
      setStatus("failed to send. please try email instead.");
    } finally {
      setSendingTarget(null);
    }
  };

  const reset = () => {
    setIdentity("");
    setSubject("");
    setMessage("");
    setStep("input");
    setOptionsPhase(null);
    setStatus("");
    setEmailError("");
  };

  const handleSendClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (step === "options") {
      e.preventDefault();
      setEmailError("");
      setStatus("");
      hideOptions(() => setStep("input"));
    }
    // When step === "input", let the form's onSubmit fire
  };

  return (
    <div className="contact-react-root">
      <form onSubmit={handleSubmit} noValidate>
        {/* Fields — freeze when not on input step */}
        <div className="cf-fields">
          <div className="cf-row">
            <label className="cf-label" htmlFor="cf-identity">identity</label>
            <input
              className="cf-input"
              id="cf-identity"
              type="text"
              value={identity}
              onChange={(e) => { setIdentity(e.target.value); setEmailError(""); }}
              placeholder="name or email, nice to meet you!"
              disabled={step !== "input"}
              required
              autoComplete="name"
            />
          </div>
          <div className="cf-row">
            <label className="cf-label" htmlFor="cf-subject">subject</label>
            <input
              className="cf-input"
              id="cf-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="what is this about?"
              disabled={step !== "input"}
              required
            />
          </div>
          <div className="cf-row">
            <label className="cf-label" htmlFor="cf-message">message</label>
            <textarea
              className="cf-input cf-textarea"
              id="cf-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="say what's on your mind..."
              rows={6}
              disabled={step !== "input"}
              required
            />
          </div>
        </div>

        {/* Action area — send button always left, options pop right horizontally */}
        <div className="cf-action-wrap">
          {step === "sent" ? (
            <div className="cf-sent">
              <span className="cf-sent-check" aria-hidden>✓</span>
              <span>message_sent.</span>
              <button type="button" className="cf-reset" onClick={reset}>reset</button>
            </div>
          ) : (
            <>
              <button
                className="cf-btn cf-btn-primary"
                type="submit"
                disabled={step === "input" && !allFilled}
                onClick={handleSendClick}
              >
                <span>send_message()</span>
                <span className="cf-arrow" aria-hidden>-&gt;</span>
              </button>

              {optionsPhase && (
                <div className="cf-options-row" key={optionsPhase}>
                  {[
                    { label: sendingTarget === "email" ? "sending..." : "email", delay: { in: 0, out: 70 }, onClick: handleEmail, disabled: sending,
                      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> },
                    { label: sendingTarget === "notification" ? "sending..." : "notification", delay: { in: 70, out: 0 }, onClick: handleNtfy, disabled: sending,
                      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg> },
                  ].map(({ label, delay, onClick, disabled, icon }) => (
                    <button
                      key={label}
                      type="button"
                      className="cf-btn cf-btn-option"
                      style={{
                        animationName: optionsPhase === "in" ? "cf-pop-in" : "cf-pop-out",
                        animationDuration: optionsPhase === "in" ? "280ms" : "200ms",
                        animationTimingFunction: optionsPhase === "in" ? "cubic-bezier(0.22,0.61,0.36,1)" : "cubic-bezier(0.4,0,1,1)",
                        animationFillMode: "both",
                        animationDelay: `${optionsPhase === "in" ? delay.in : delay.out}ms`,
                      }}
                      onClick={onClick}
                      disabled={disabled}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {(emailError || status) && step !== "sent" && (
          <p className="cf-err" style={{ marginTop: "0.5rem" }}>{emailError || status}</p>
        )}
      </form>
    </div>
  );
};
