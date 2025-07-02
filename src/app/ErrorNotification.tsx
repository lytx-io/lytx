import React from "react";

interface ErrorNotificationProps {
  error: Error;
}

const ErrorNotification = React.memo(function ErrorNotification({
  error,
}: ErrorNotificationProps) {
  return (
    <div className="fixed top-4 right-4 bg-[var(--color-danger)] text-white p-4 rounded-lg shadow-lg z-50">
      <p className="font-semibold">Error loading dashboard data</p>
      <p className="text-sm">{error.message}</p>
    </div>
  );
});

export default ErrorNotification;
