import { MarketingLayout } from "@/app/components/marketing/MarketingLayout";
import { SectionHeading } from "@/app/components/marketing/SectionHeading";

export function TermsOfService() {
  return (
    <MarketingLayout>
      <section className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            as="h1"
            badge="Legal"
            title="Terms of Service"
            subtitle="These terms govern your use of the Lytx product provided by Riche Ventures, Inc."
          />

          <div className="space-y-8 text-slate-600 dark:text-slate-400">
            <p className="text-sm text-slate-500 dark:text-slate-500">Last updated: January 29, 2026</p>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Agreement to these terms</h2>
              <p>
              By accessing or using the Services, you agree to these Terms of Service ("Terms"). If
              you are using the Services on behalf of an organization, you represent that you have
              authority to bind that organization to these Terms.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">About Lytx</h2>
              <p>
              Lytx is a product of Riche Ventures, Inc. ("Riche Ventures", "we", "us"). The
              Services provide privacy-first analytics tools, including hosted and self-hosted
              options.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Accounts and security</h2>
              <ul className="space-y-2 list-disc pl-5">
                <li>You are responsible for maintaining the confidentiality of your account.</li>
                <li>You agree to provide accurate information and keep it up to date.</li>
                <li>You must notify us promptly of any unauthorized use of your account.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Acceptable use</h2>
              <ul className="space-y-2 list-disc pl-5">
                <li>Do not use the Services for unlawful, harmful, or abusive activities.</li>
                <li>Do not attempt to interfere with or disrupt the Services or networks.</li>
                <li>Do not access or use the Services to build a competing product.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your data</h2>
              <p>
              You retain ownership of the data you send to the Services. You grant us a limited
              license to process that data to provide and improve the Services. For analytics data
              collected from your sites, you are responsible for providing any required notices to
              your users.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Open source and self-hosting</h2>
              <p>
              The Lytx codebase is available as open source. If you choose to self-host, you are
              responsible for your hosting environment, security, and compliance obligations.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Termination</h2>
              <p>
              You may stop using the Services at any time. We may suspend or terminate access if you
              violate these Terms or if your use poses a security risk.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Disclaimers</h2>
              <p>
              The Services are provided "as is" without warranties of any kind, express or implied.
              We do not warrant that the Services will be uninterrupted or error-free.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Limitation of liability</h2>
              <p>
              To the maximum extent permitted by law, Riche Ventures will not be liable for any
              indirect, incidental, special, or consequential damages arising out of or related to
              your use of the Services.
              </p>
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Changes to these terms</h2>
              <p>
              We may update these Terms from time to time. If we make material changes, we will
              update the date above and post the revised Terms.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
