import React from "react";
import { type ScorecardProps } from "@db/tranformReports";

const Scorecard: React.FC<ScorecardProps> = ({
  title,
  value,
  change,
  changeType,
  changeLabel,
}) => {
  const getChangeIcon = () => {
    if (changeType === "positive") {
      return (
        <svg
          className="h-4 w-4 text-[var(--color-secondary)] mr-1"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    } else if (changeType === "negative") {
      return (
        <svg
          className="h-4 w-4 text-[var(--color-danger)] mr-1"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    } else {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-[var(--theme-text-secondary)] mr-1"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <rect y="9" width="20" height="2" />
        </svg>
      );
    }
  };

  const getChangeColor = () => {
    if (changeType === "positive") return "text-[var(--color-secondary)]";
    if (changeType === "negative") return "text-[var(--color-danger)]";
    return "text-[var(--theme-text-secondary)]";
  };

  return (
    <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg p-4 flex-1 min-w-[140px] text-left">
      <h3 className="text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider mb-1">
        {title}
      </h3>
      <p className="text-2xl font-bold text-[var(--theme-text-primary)] mb-1">
        {value}
      </p>
      <div className="flex items-center justify-start">
        {getChangeIcon()}
        <span className="text-xs text-[var(--theme-text-secondary)]">
          <span className={getChangeColor()}>{change}</span> {changeLabel}
        </span>
      </div>
    </div>
  );
};

const ScorecardsSection = React.memo(function ScorecardsSection() {
  return (
    <section className="flex flex-row flex-wrap lg:flex-nowrap justify-between gap-4 mb-8">
      <Scorecard
        title="UNIQUE VISITORS"
        value="10,567"
        change="5.2%"
        changeType="positive"
        changeLabel="vs last month"
      />
      <Scorecard
        title="TOTAL PAGEVIEWS"
        value="250,930"
        change="12.1%"
        changeType="positive"
        changeLabel="vs last month"
      />
      <Scorecard
        title="BOUNCE RATE"
        value="47.5%"
        change="-2.0%"
        changeType="negative"
        changeLabel="vs last month"
      />
      <Scorecard
        title="AVG. SESSION DURATION"
        value="3m 45s"
        change="+15s"
        changeType="positive"
        changeLabel="vs last month"
      />
      <Scorecard
        title="CONVERSION RATE"
        value="5.7%"
        change="+0.5%"
        changeType="positive"
        changeLabel="vs last month"
      />
      <Scorecard
        title="NEW USERS"
        value="1,200"
        change="0.0%"
        changeType="neutral"
        changeLabel="vs last month"
      />
    </section>
  );
});

export default ScorecardsSection;
