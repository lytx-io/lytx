export type SiteTagProps = {
  tag_id: string;
  domain: string;
  lytx_domain?: string;
};

export const SiteTag: React.FC<SiteTagProps> = ({
  tag_id,
  domain,
  lytx_domain,
}) => {
  if (!lytx_domain) lytx_domain = "lytx.io";

  return (
    <code className="text-sm">
      <span style={{ color: "#6c7086" }}>&lt;</span>
      <span style={{ color: "#f38ba8", fontWeight: "600" }}>script</span>
      <span style={{ color: "#6c7086" }}> </span>
      <span style={{ color: "#a6e3a1" }}>defer</span>
      <span style={{ color: "#6c7086" }}> </span>
      <span style={{ color: "#a6e3a1" }}>data-domain</span>
      <span style={{ color: "#6c7086" }}>=</span>
      <span style={{ color: "#fab387" }}>"{domain}"</span>
      <span style={{ color: "#6c7086" }}> </span>
      <span style={{ color: "#a6e3a1" }}>src</span>
      <span style={{ color: "#6c7086" }}>=</span>
      <span style={{ color: "#fab387" }}>
        "https://{lytx_domain}/lytx.js?account={tag_id}"
      </span>
      <span style={{ color: "#6c7086" }}>&gt;&lt;/</span>
      <span style={{ color: "#f38ba8", fontWeight: "600" }}>script</span>
      <span style={{ color: "#6c7086" }}>&gt;</span>
    </code>
  );
};
