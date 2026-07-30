import SuccessToast from "../../ui/SuccessToast";

export default function DeploymentToast({
  show = false,
  message = "",
  title = "Deployment Updated",
  duration = 3500,
  onClose,
}) {
  const visibleMessage =
    show && String(message || "").trim()
      ? String(message).trim()
      : "";

  return (
    <SuccessToast
      title={title}
      message={visibleMessage}
      duration={duration}
      onClose={onClose}
    />
  );
}