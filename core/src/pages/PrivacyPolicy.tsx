import { MarketingLayout } from "@/app/components/marketing/MarketingLayout";
import { SectionHeading } from "@/app/components/marketing/SectionHeading";

export function PrivacyPolicy() {
  return (
    <MarketingLayout>
      <section className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            as="h1"
            badge="Legal"
            title="Privacy Policy"
            subtitle="Lytx is a privacy-first analytics platform. This policy explains how Riche Ventures, Inc. collects and uses information when you use the Lytx product."
          />

          <div className="space-y-8 text-slate-600 dark:text-slate-400">
            <p className="text-sm text-slate-500 dark:text-slate-500">Last updated: January 29, 2026</p>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Who we are</h2>
              <p>
              Lytx is a product of Riche Ventures, Inc. ("Riche Ventures", "we", "us").
              This Privacy Policy applies to the Lytx website, application, and analytics services
              (the "Services").
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Information we collect</h2>
              <ul className="space-y-2 list-disc pl-5">
                <li>
                  Account information such as name, email address, and login credentials.
                </li>
                <li>
                  Usage data about how you use the Services, including feature usage, settings, and
                  performance metrics.
                </li>
                <li>
                  Support and communications you send to us.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Analytics data from your sites</h2>
              <p>
              When you install the Lytx script on your site, Lytx processes analytics data on your
              behalf. You are the controller of that data and we act as a processor. We do not use
              cookies or fingerprinting in the Lytx analytics script. We do not store full IP
              addresses in analytics data; any transient processing of IP addresses is limited to
              security and abuse prevention.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">How we use information</h2>
              <ul className="space-y-2 list-disc pl-5">
                <li>Provide, operate, and maintain the Services.</li>
                <li>Authenticate users, secure accounts, and prevent abuse.</li>
                <li>Improve product performance and user experience.</li>
                <li>Respond to support requests and send service communications.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sharing of information</h2>
              <p>
              We share information only with service providers needed to deliver the Services (such
              as hosting and email), to comply with legal obligations, or in connection
              with a business transfer. We do not sell your data.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Data retention</h2>
              <p>
              We retain account and usage data for as long as your account is active or as needed to
              provide the Services. You can request deletion of your account and associated data.
              Analytics data retention for customer sites is controlled by the customer.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your choices</h2>
              <ul className="space-y-2 list-disc pl-5">
                <li>Access and update your account information in your settings.</li>
                <li>Request account deletion by contacting us.</li>
                <li>Opt out of non-essential communications.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Contact</h2>
              <p>
                Riche Ventures, Inc.<br />
                390 NE 191st St STE 27725<br />
                Miami, FL 33179<br />
                Email:{" "}
                <a
                  href="mailto:legal@yourdomain.com"
                  className="text-slate-600 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 underline underline-offset-4"
                >
                  legal@yourdomain.com
                </a>
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Changes to this policy</h2>
              <p>
              We may update this Privacy Policy from time to time. If we make material changes, we
              will update the date above and post the revised policy.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
