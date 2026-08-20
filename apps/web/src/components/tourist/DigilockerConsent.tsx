"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  DEMO_DIGILOCKER_AADHAAR,
  DEMO_DIGILOCKER_CODE,
  DEMO_DIGILOCKER_PROFILE,
} from "@sts/shared";

type DigilockerConsentProps = {
  cancelHref: string;
  cancelLabel: string;
};

type Step = "signin" | "consent" | "fetching";
type Method = "mobile" | "aadhaar";

const DEMO_MOBILE = "9876543210";
const DEMO_PIN = "123456";
const DEMO_OTP = "654321";

const FETCH_STEPS = [
  "Authenticating with DigiLocker",
  "Listing issued documents",
  "Fetching eAadhaar XML",
  "Fetching driving licence",
  "Fetching voter ID (EPIC)",
  "Sharing with Smart Tourist Safety",
] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function DigiLockerMark() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-md bg-white/15">
        <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-white" strokeWidth="1.8">
          <rect x="5" y="10" width="14" height="10" rx="1.5" />
          <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
          <circle cx="12" cy="15" r="1.2" fill="white" stroke="none" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-base font-semibold tracking-wide">DigiLocker</span>
        <span className="block text-[10px] font-normal tracking-[0.18em] text-white/75 uppercase">
          National Digital Locker
        </span>
      </span>
    </span>
  );
}

function DigilockerConsentInner({
  cancelHref,
  cancelLabel,
}: DigilockerConsentProps) {
  const params = useSearchParams();
  const state = params.get("state") ?? "";
  const [step, setStep] = useState<Step>("signin");
  const [method, setMethod] = useState<Method>("mobile");
  const [mobile, setMobile] = useState(DEMO_MOBILE);
  const [pin, setPin] = useState(DEMO_PIN);
  const [aadhaar, setAadhaar] = useState(DEMO_DIGILOCKER_AADHAAR);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(DEMO_OTP);
  const [error, setError] = useState<string | null>(null);
  const [fetchIndex, setFetchIndex] = useState(0);

  function go(query: string) {
    window.location.assign(`/api/identity/digilocker/callback?${query}`);
  }

  function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (method === "mobile") {
      const digits = mobile.replace(/\D/g, "");
      if (digits.length !== 10) {
        setError("Enter the 10-digit mobile number registered with DigiLocker.");
        return;
      }
      if (pin.length !== 6) {
        setError("Enter your 6-digit security PIN.");
        return;
      }
    } else {
      const digits = aadhaar.replace(/\D/g, "");
      if (digits.length !== 12) {
        setError("Enter the 12-digit Aadhaar number.");
        return;
      }
      if (!otpSent) {
        setOtpSent(true);
        return;
      }
      if (otp.replace(/\D/g, "").length !== 6) {
        setError("Enter the 6-digit OTP sent to the registered mobile.");
        return;
      }
    }
    setStep("consent");
  }

  async function allow() {
    setStep("fetching");
    for (let index = 0; index < FETCH_STEPS.length; index += 1) {
      setFetchIndex(index);
      await sleep(380);
    }
    go(`code=${encodeURIComponent(DEMO_DIGILOCKER_CODE)}&state=${encodeURIComponent(state)}`);
  }

  if (!state) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#eef3fb] px-4">
        <div className="max-w-md text-center">
          <p className="text-sm text-[#b71c1c]">DigiLocker session expired.</p>
          <Link href={cancelHref} className="mt-3 inline-block text-sm font-medium text-[#0b3a82]">
            {cancelLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#eef3fb] text-[#102a56]">
      <header className="bg-[#0b3a82] px-4 py-3 text-white shadow">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <DigiLockerMark />
          <span className="text-[10px] tracking-wide text-white/70 uppercase">MeitY</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
        {step === "signin" ? (
          <form
            onSubmit={signIn}
            className="rounded-lg border border-[#d5deef] bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium tracking-[0.16em] text-[#5c6b8a] uppercase">
              Sign in to DigiLocker
            </p>
            <h1 className="mt-1 text-lg font-semibold">Share issued documents</h1>
            <p className="mt-1 text-sm text-[#5c6b8a]">
              Smart Tourist Safety is requesting eAadhaar and issued KYC documents from
              your locker.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-[#eef3fb] p-1 text-sm">
              <button
                type="button"
                className={`rounded px-3 py-2 font-medium ${method === "mobile" ? "bg-white text-[#0b3a82] shadow-sm" : "text-[#5c6b8a]"}`}
                onClick={() => {
                  setMethod("mobile");
                  setError(null);
                }}
              >
                Mobile
              </button>
              <button
                type="button"
                className={`rounded px-3 py-2 font-medium ${method === "aadhaar" ? "bg-white text-[#0b3a82] shadow-sm" : "text-[#5c6b8a]"}`}
                onClick={() => {
                  setMethod("aadhaar");
                  setError(null);
                }}
              >
                Aadhaar
              </button>
            </div>

            {method === "mobile" ? (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-medium text-[#5c6b8a]" htmlFor="dl-mobile">
                  Registered mobile number
                </label>
                <div className="flex overflow-hidden rounded-md border border-[#c5d0e6]">
                  <span className="grid place-items-center bg-[#f4f7fc] px-3 text-sm text-[#5c6b8a]">
                    +91
                  </span>
                  <input
                    id="dl-mobile"
                    data-testid="digilocker-mobile"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full px-3 py-2 text-sm outline-none"
                  />
                </div>
                <label className="block text-xs font-medium text-[#5c6b8a]" htmlFor="dl-pin">
                  6-digit security PIN
                </label>
                <input
                  id="dl-pin"
                  data-testid="digilocker-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full rounded-md border border-[#c5d0e6] px-3 py-2 text-sm outline-none"
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-medium text-[#5c6b8a]" htmlFor="dl-aadhaar">
                  Aadhaar number
                </label>
                <input
                  id="dl-aadhaar"
                  data-testid="digilocker-aadhaar"
                  inputMode="numeric"
                  maxLength={12}
                  value={aadhaar}
                  onChange={(event) =>
                    setAadhaar(event.target.value.replace(/\D/g, "").slice(0, 12))
                  }
                  className="w-full rounded-md border border-[#c5d0e6] px-3 py-2 text-sm outline-none"
                />
                {otpSent ? (
                  <>
                    <label className="block text-xs font-medium text-[#5c6b8a]" htmlFor="dl-otp">
                      OTP
                    </label>
                    <input
                      id="dl-otp"
                      data-testid="digilocker-otp"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full rounded-md border border-[#c5d0e6] px-3 py-2 text-sm outline-none"
                    />
                    <p className="text-xs text-[#2e7d32]">OTP sent to the registered mobile.</p>
                  </>
                ) : null}
              </div>
            )}

            {error ? <p className="mt-3 text-xs text-[#b71c1c]">{error}</p> : null}

            <button
              type="submit"
              data-testid="digilocker-signin"
              className="mt-5 w-full rounded-md bg-[#0b3a82] py-2.5 text-sm font-semibold text-white"
            >
              {method === "aadhaar" && !otpSent ? "Get OTP" : "Sign in"}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-[#7a869d]">
              Issued session for this flow uses mobile {DEMO_MOBILE} / PIN {DEMO_PIN}, or
              Aadhaar OTP {DEMO_OTP}.
            </p>
          </form>
        ) : null}

        {step === "consent" ? (
          <div className="rounded-lg border border-[#d5deef] bg-white p-5 shadow-sm">
            <p className="text-xs font-medium tracking-[0.16em] text-[#5c6b8a] uppercase">
              Authorization request
            </p>
            <h1 className="mt-1 text-lg font-semibold">Allow access to issued documents?</h1>
            <p className="mt-1 text-sm text-[#5c6b8a]">
              <span className="font-medium text-[#102a56]">Smart Tourist Safety</span> wants to
              fetch the following from your DigiLocker.
            </p>
            <ul className="mt-4 space-y-2">
              {DEMO_DIGILOCKER_PROFILE.documents.map((doc) => (
                <li
                  key={doc.doctype}
                  className="flex items-start gap-3 rounded-md border border-[#e3eaf6] bg-[#f7f9fd] px-3 py-2.5"
                >
                  <input type="checkbox" defaultChecked readOnly className="mt-1 accent-[#0b3a82]" />
                  <span>
                    <span className="block text-sm font-medium">{doc.label}</span>
                    <span className="block text-xs text-[#5c6b8a]">{doc.issuer}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                data-testid="digilocker-allow"
                onClick={() => void allow()}
                className="flex-1 rounded-md bg-[#2e7d32] py-2.5 text-sm font-semibold text-white"
              >
                Allow
              </button>
              <button
                type="button"
                data-testid="digilocker-deny"
                onClick={() =>
                  go(`error=access_denied&state=${encodeURIComponent(state)}`)
                }
                className="flex-1 rounded-md border border-[#c5d0e6] bg-white py-2.5 text-sm font-semibold text-[#5c6b8a]"
              >
                Deny
              </button>
            </div>
          </div>
        ) : null}

        {step === "fetching" ? (
          <div className="rounded-lg border border-[#d5deef] bg-white p-5 shadow-sm">
            <p className="text-xs font-medium tracking-[0.16em] text-[#5c6b8a] uppercase">
              Fetching issued documents
            </p>
            <h1 className="mt-1 text-lg font-semibold">Please wait</h1>
            <ol className="mt-4 space-y-2">
              {FETCH_STEPS.map((label, index) => {
                const done = index < fetchIndex;
                const current = index === fetchIndex;
                return (
                  <li
                    key={label}
                    className={`flex items-center gap-2 text-sm ${current ? "font-medium text-[#0b3a82]" : done ? "text-[#2e7d32]" : "text-[#7a869d]"}`}
                  >
                    <span className="grid size-5 place-items-center rounded-full border border-current text-[10px]">
                      {done ? "✓" : index + 1}
                    </span>
                    {label}
                    {current ? "…" : null}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

        <p className="mt-auto pt-6 text-center text-[11px] text-[#7a869d]">
          <Link href={cancelHref} className="underline-offset-2 hover:underline">
            {cancelLabel}
          </Link>
          {" · "}National Digital Locker process for Smart Tourist Safety
        </p>
      </main>
    </div>
  );
}

export function DigilockerConsent(props: DigilockerConsentProps) {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#eef3fb] text-sm text-[#5c6b8a]">
          Opening DigiLocker…
        </div>
      }
    >
      <DigilockerConsentInner {...props} />
    </Suspense>
  );
}
