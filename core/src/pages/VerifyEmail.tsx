type VerifyEmailStatus =
  | { type: "success"; message: string; callbackURL?: string }
  | { type: "error"; message: string; callbackURL?: string };

export function VerifyEmail({ status }: { status: VerifyEmailStatus }) {
  const title = status.type === "success" ? "Email verified" : "Unable to verify email";
  const messageColor = status.type === "success" ? "text-green-600" : "text-red-600";

  return (
    <div className="flex flex-col justify-center items-center py-12 font-montserrat">
      <div className="flex flex-col min-h-[200px] w-full justify-center items-center px-4">
        <div className="h-auto">
          <span className="text-3xl font-semibold">Lytx</span>
        </div>

        <div className="h-auto my-4 text-lg font-medium">{title}</div>

        <div className={`w-full max-w-[420px] text-sm ${messageColor}`}>{status.message}</div>

        {status.callbackURL ? (
          <div className="mt-4 w-full max-w-[420px] text-sm text-gray-600">
            <div className="mb-2">Redirecting you shortly…</div>
            <a className="underline" href={status.callbackURL}>
              Continue
            </a>
          </div>
        ) : (
          <div className="mt-4 w-full max-w-[420px] text-sm text-gray-600">
            <a className="underline" href="/login">
              Go to sign in
            </a>
          </div>
        )}

        {status.type === "error" ? (
          <div className="mt-6 w-full max-w-[420px] text-sm text-gray-600">
            <div>If you still need a link, you can resend one from the sign-in page.</div>
            <a className="underline" href="/login">
              Resend verification email
            </a>
          </div>
        ) : null}

        {status.type === "success" && status.callbackURL ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `setTimeout(() => { window.location.href = ${JSON.stringify(
                status.callbackURL,
              )}; }, 1500);`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
