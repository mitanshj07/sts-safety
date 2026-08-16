// apps/web/src/lib/notify/templates/IncidentAlertEmail.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type IncidentAlertEmailProps = {
  title: string;
  body: string;
  touristName: string;
  severity: string;
  type: string;
  where: string;
  coords: string;
  occurredAt: string;
  dashboardUrl: string;
};

export function IncidentAlertEmail(props: IncidentAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{props.title}</Preview>
      <Body style={bodyStyle}>
        <Container style={card}>
          <Heading style={h1}>Smart Tourist Safety</Heading>
          <Text style={badge}>{props.severity.toUpperCase()}</Text>
          <Heading as="h2" style={h2}>
            {props.title}
          </Heading>
          <Text style={p}>{props.body}</Text>
          <Hr style={hr} />
          <Section>
            <Text style={meta}>Tourist: {props.touristName}</Text>
            <Text style={meta}>Type: {props.type}</Text>
            <Text style={meta}>Location: {props.where}</Text>
            <Text style={meta}>Coords: {props.coords}</Text>
            <Text style={meta}>Occurred: {props.occurredAt}</Text>
          </Section>
          <Button href={props.dashboardUrl} style={btn}>
            Open control room
          </Button>
          <Text style={foot}>
            MDoNER · NE Tourist Safety Control Room. This alert is independent of
            chain / LLM / ML.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = { backgroundColor: "#0b1220", fontFamily: "Inter, sans-serif" };
const card = {
  backgroundColor: "#111827",
  margin: "24px auto",
  padding: "28px",
  borderRadius: "12px",
  maxWidth: "560px",
  color: "#e5e7eb",
};
const h1 = { fontSize: "13px", letterSpacing: "0.16em", color: "#9ca3af", textTransform: "uppercase" as const };
const h2 = { fontSize: "22px", color: "#f9fafb", margin: "8px 0 12px" };
const p = { fontSize: "15px", lineHeight: "1.5", color: "#e5e7eb" };
const meta = { fontSize: "13px", color: "#d1d5db", margin: "0 0 4px" };
const badge = {
  display: "inline-block",
  backgroundColor: "#7f1d1d",
  color: "#fecaca",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "11px",
  letterSpacing: "0.12em",
};
const btn = {
  backgroundColor: "#b91c1c",
  color: "#fff",
  padding: "12px 18px",
  borderRadius: "8px",
  textDecoration: "none",
  display: "inline-block",
  marginTop: "16px",
};
const hr = { borderColor: "#1f2937", margin: "16px 0" };
const foot = { fontSize: "11px", color: "#6b7280", marginTop: "24px" };
