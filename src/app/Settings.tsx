"use client";

import { useState } from "react";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { SiteTag } from "@/app/components/SiteTag";
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SiteTagData {
  id: string;
  name: string;
  domain: string;
  tagId: string;
  status: "active" | "inactive";
  createdAt: string;
}

export function SettingsPage() {
  const [teamName, setTeamName] = useState("My Team");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
      role: "Admin",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "Member",
    },
  ]);
  const [siteTags] = useState<SiteTagData[]>([
    {
      id: "1",
      name: "Main Website",
      domain: "example.com",
      tagId: "lytx-main-001",
      status: "active",
      createdAt: "2024-01-15",
    },
    {
      id: "2",
      name: "Landing Page",
      domain: "landing.example.com",
      tagId: "lytx-landing-002",
      status: "active",
      createdAt: "2024-01-20",
    },
  ]);

  return (
    <div className="p-6 bg-[var(--theme-bg-primary)] min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-[var(--theme-text-primary)] mb-8">
          Settings
        </h1>

        {/* Team Name Section */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-4">
            Team Name
          </h2>
          <div className="flex items-center space-x-4">
            <Input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="flex-1"
              placeholder="Enter team name"
            />
            <Button variant="primary">Save</Button>
          </div>
        </Card>

        {/* Team Members Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--theme-text-primary)]">
              Team Members
            </h2>
            <Button variant="secondary">Add Member</Button>
          </div>

          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-[var(--theme-bg-secondary)] rounded-lg border border-[var(--theme-border-primary)]"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <Input
                        type="text"
                        value={member.name}
                        onChange={(e) => {
                          setTeamMembers((prev) =>
                            prev.map((m) =>
                              m.id === member.id
                                ? { ...m, name: e.target.value }
                                : m,
                            ),
                          );
                        }}
                        className="mb-2"
                        placeholder="Member name"
                      />
                      <Input
                        type="email"
                        value={member.email}
                        onChange={(e) => {
                          setTeamMembers((prev) =>
                            prev.map((m) =>
                              m.id === member.id
                                ? { ...m, email: e.target.value }
                                : m,
                            ),
                          );
                        }}
                        placeholder="Member email"
                      />
                    </div>
                    <div className="w-32">
                      <select
                        value={member.role}
                        onChange={(e) => {
                          setTeamMembers((prev) =>
                            prev.map((m) =>
                              m.id === member.id
                                ? { ...m, role: e.target.value }
                                : m,
                            ),
                          );
                        }}
                        className="w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-md text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Member">Member</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="ml-4 space-x-2">
                  <Button variant="primary" size="sm">
                    Save
                  </Button>
                  <Button variant="danger" size="sm">
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Site Tags Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[var(--theme-text-primary)]">
              Site Tags
            </h2>
            <Button variant="secondary">Add New Site</Button>
          </div>

          <div className="space-y-6">
            {siteTags.map((tag) => (
              <div
                key={tag.id}
                className="border border-[var(--theme-border-primary)] rounded-lg p-6 bg-[var(--theme-bg-secondary)]"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-[var(--theme-text-primary)]">
                        {tag.name}
                      </h3>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${tag.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                          }`}
                      >
                        {tag.status}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--theme-text-secondary)] space-y-1">
                      <p>
                        <span className="font-medium">Domain:</span>{" "}
                        {tag.domain}
                      </p>
                      <p>
                        <span className="font-medium">Tag ID:</span>{" "}
                        <code className="bg-[var(--theme-input-bg)] px-2 py-1 rounded text-xs">
                          {tag.tagId}
                        </code>
                      </p>
                      <p>
                        <span className="font-medium">Created:</span>{" "}
                        {tag.createdAt}
                      </p>
                    </div>
                  </div>

                </div>

                <div className="border-t border-[var(--theme-border-primary)] pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-[var(--theme-text-primary)]">
                      Installation Script
                    </label>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const scriptText = document.querySelector(
                          `#script-${tag.id}`,
                        )?.textContent;
                        if (scriptText) {
                          navigator.clipboard.writeText(scriptText);
                          alert("Script copied to clipboard!");
                        }
                      }}
                    >
                      Copy Script
                    </Button>
                  </div>
                  <div
                    id={`script-${tag.id}`}
                    className="bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-md p-4 font-mono text-sm text-[var(--theme-text-primary)] overflow-x-auto"
                  >
                    <SiteTag domain={tag.domain} tag_id={tag.tagId} />
                  </div>
                  <p className="text-xs text-[var(--theme-text-secondary)] mt-2">
                    Copy and paste this script into the &lt;head&gt; section of
                    your website to start tracking.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default SettingsPage;
