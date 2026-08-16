// apps/web/src/lib/notify/templates/EfirEmail.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export type EfirEmailProps = {
  touristName: string;
  incidentId: string;
  narrative: string;
  stationName: string;
  occurredAt: string;
};

export function EfirEmail(props: EfirEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`E-FIR draft · ${props.touristName}`}</Preview>
      <Body style={bodyStyle}>
        <Container style={card}>
          <Heading style={h1}>E-FIR draft for review</Heading>
          <Text style={p}>
            Station: {props.stationName}. Incident {props.incidentId}. Subject:{" "}
            {props.touristName}. Occurred {props.occurredAt}.
          </Text>
          <Hr style={hr} />
          <Text style={pre}>{props.narrative}</Text>
          <Text style={foot}>
            PDF attached when generated. Hash will be anchored on Polygon Amoy
            after officer approval. No PII is written on-chain.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = { backgroundColor: "#0b1220", fontFamily: "Georgia, serif" };
const card = {
  backgroundColor: "#111827",
  margin: "24px auto",
  padding: "28px",
  borderRadius: "12px",
  maxWidth: "640px",
  color: "#e5e7eb",
};
const h1 = { fontSize: "20px", color: "#f9fafb" };
const p = { fontSize: "14px", lineHeight: "1.5" };
const pre = {
  fontSize: "13px",
  lineHeight: "1.55",
  whiteSpace: "pre-wrap" as const,
  color: "#d1d5db",
};
const hr = { borderColor: "#1f2937", margin: "16px 0" };
const foot = { fontSize: "11px", color: "#6b7280", marginTop: "24px" };
