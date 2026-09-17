export default function Pill({ status }) {
  return <span className={"pill " + status}>{status}</span>;
}
