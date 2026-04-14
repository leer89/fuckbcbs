import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import type { FormData } from '@/types/form';
import { getLocationNpi } from '@/data/locations';

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 28,
    paddingRight: 28,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
  },

  // ─── Header ─────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerLeft: {
    flex: 2,
    flexDirection: 'column',
  },
  headerCompany: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#003087',
  },
  headerSubtitle: {
    fontSize: 7.5,
    color: '#003087',
  },
  headerTitle: {
    flex: 3,
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    alignSelf: 'center',
  },
  headerBoxRight: {
    flex: 2,
    border: 1,
    borderColor: '#000',
    padding: 5,
    fontSize: 8,
  },

  // ─── Instructions ────────────────────────────────────────────────────────────
  instructions: {
    fontSize: 8.5,
    marginBottom: 4,
  },
  bullet: {
    fontSize: 8.5,
    marginLeft: 10,
    marginBottom: 2,
    lineHeight: 1.4,
  },
  subBullet: {
    fontSize: 8.5,
    marginLeft: 20,
    marginBottom: 1,
    lineHeight: 1.4,
  },

  // ─── Outer border wrapper for all sections ───────────────────────────────────
  outerBorder: {
    border: 1,
    borderColor: '#000',
    marginTop: 8,
  },

  // ─── Section header row ──────────────────────────────────────────────────────
  sectionHeader: {
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottom: 1,
    borderBottomColor: '#000',
  },
  sectionHeaderText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },

  // ─── Table rows ──────────────────────────────────────────────────────────────
  tableRow: {
    flexDirection: 'row',
  },
  cellLeft: {
    flex: 1,
    borderRight: 1,
    borderRightColor: '#000',
    borderBottom: 1,
    borderBottomColor: '#000',
    paddingVertical: 5,
    paddingHorizontal: 5,
    minHeight: 32,
  },
  cellRight: {
    flex: 2,
    borderBottom: 1,
    borderBottomColor: '#000',
    paddingVertical: 5,
    paddingHorizontal: 5,
    minHeight: 32,
  },
  cellFull: {
    flex: 1,
    borderBottom: 1,
    borderBottomColor: '#000',
    paddingVertical: 5,
    paddingHorizontal: 5,
    minHeight: 32,
  },
  cellThird: {
    flex: 1,
    borderRight: 1,
    borderRightColor: '#000',
    borderBottom: 1,
    borderBottomColor: '#000',
    paddingVertical: 5,
    paddingHorizontal: 5,
    minHeight: 32,
  },
  cellThirdLast: {
    flex: 1,
    borderBottom: 1,
    borderBottomColor: '#000',
    paddingVertical: 5,
    paddingHorizontal: 5,
    minHeight: 32,
  },
  fieldLabel: {
    fontSize: 7,
    color: '#555555',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    minHeight: 12,
  },

  // ─── Comments ────────────────────────────────────────────────────────────────
  commentsLabel: {
    paddingVertical: 3,
    paddingHorizontal: 5,
    fontSize: 7,
    color: '#555555',
  },
  commentsArea: {
    minHeight: 90,
    paddingVertical: 5,
    paddingHorizontal: 5,
    fontSize: 9,
  },

  // ─── Signature ───────────────────────────────────────────────────────────────
  sigStatement: {
    fontSize: 8,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottom: 1,
    borderBottomColor: '#000',
  },
  signatureRow: {
    flexDirection: 'row',
    minHeight: 55,
  },
  signatureCell: {
    flex: 3,
    borderRight: 1,
    borderRightColor: '#000',
    paddingHorizontal: 5,
    paddingTop: 5,
  },
  signatureXLabel: {
    fontSize: 9,
    marginBottom: 2,
  },
  signatureLabel: {
    fontSize: 7,
    color: '#555555',
    marginTop: 4,
  },
  signatureImg: {
    height: 30,
    maxWidth: 200,
    objectFit: 'contain',
  },
  dateCell: {
    flex: 1,
    paddingHorizontal: 5,
    paddingTop: 5,
  },
  dateLabel: {
    fontSize: 7,
    color: '#555555',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 9,
    minHeight: 12,
  },

  // ─── Instructions section ────────────────────────────────────────────────────
  instrRow: {
    flexDirection: 'row',
    padding: 8,
  },
  instrLeft: {
    flex: 1,
    borderRight: 1,
    borderRightColor: '#000',
    paddingRight: 10,
  },
  instrRight: {
    flex: 1,
    paddingLeft: 10,
  },
  instrText: {
    fontSize: 8.5,
    lineHeight: 1.5,
  },
  instrBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
  },

  // ─── Footer ──────────────────────────────────────────────────────────────────
  pageFooter: {
    marginTop: 6,
    fontSize: 7,
    color: '#555555',
  },
  keepCopy: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 5,
    borderTop: 1,
    borderTopColor: '#000',
  },
});

interface BCNPDFDocumentProps {
  data: FormData;
}

function buildCommentText(data: FormData): string {
  const parts: string[] = [];

  if (data.urgentCareLocation) {
    const npi = getLocationNpi(data.urgentCareLocation);
    const locationLine = npi
      ? `NPI ${npi} - ${data.urgentCareLocation}`
      : data.urgentCareLocation;
    parts.push(locationLine);
    for (const code of data.selectedMedicalCodes ?? []) {
      parts.push(`- ${code}`);
    }
  }

  if (data.claimDescription?.trim()) {
    if (parts.length > 0) parts.push('');
    parts.push(data.claimDescription.trim());
  }

  return parts.join('\n');
}

export default function BCNPDFDocument({ data }: BCNPDFDocumentProps) {
  return (
    <Document title="BCN Member Reimbursement Form" author="Blue Care Network">
      <Page size="LETTER" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerCompany}>Blue Care Network</Text>
            <Text style={styles.headerSubtitle}>of Michigan</Text>
          </View>
          <Text style={styles.headerTitle}>Member Reimbursement Form</Text>
          <View style={styles.headerBoxRight}>
            <Text>I paid out of pocket and am{'\n'}requesting reimbursement{'\n'}for medical services.</Text>
          </View>
        </View>

        {/* ── Instructions ── */}
        <Text style={styles.instructions}>
          Please fully complete the form, printing clearly, sign and date.
        </Text>
        <Text style={styles.bullet}>
          {'\u25A0'} If submitting claims for more than one family member, complete a new form for each person.
        </Text>
        <Text style={styles.bullet}>
          {'\u25A0'} Submit an itemized statement for each medical expense, including:
        </Text>
        <Text style={styles.subBullet}>- Name of Patient</Text>
        <Text style={styles.subBullet}>- Who provided the service (doctor or facility name), phone number, tax ID and NPI</Text>
        <Text style={styles.subBullet}>- Diagnosis code and procedure code (description of service)</Text>
        <Text style={styles.subBullet}>- Date(s) of service</Text>
        <Text style={styles.subBullet}>- Amount charged for each service</Text>
        <Text style={styles.subBullet}>- Proof of payment</Text>

        {/* ── Outer bordered box ── */}
        <View style={styles.outerBorder}>

          {/* Section 1 - Member Information */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>Section 1 - Member Information</Text>
          </View>

          {/* Row 1: Enrollee ID | Enrollee Name */}
          <View style={styles.tableRow}>
            <View style={styles.cellLeft}>
              <Text style={styles.fieldLabel}>Enrollee ID (on your member ID card)</Text>
              <Text style={styles.fieldValue}>{data.enrolleeId}</Text>
            </View>
            <View style={styles.cellRight}>
              <Text style={styles.fieldLabel}>Enrollee Name</Text>
              <Text style={styles.fieldValue}>{data.enrolleeName}</Text>
            </View>
          </View>

          {/* Row 2: Patient Name | Patient DOB */}
          <View style={styles.tableRow}>
            <View style={{ flex: 3, borderRight: 1, borderRightColor: '#000', borderBottom: 1, borderBottomColor: '#000', paddingVertical: 5, paddingHorizontal: 5, minHeight: 32 }}>
              <Text style={styles.fieldLabel}>Patient name</Text>
              <Text style={styles.fieldValue}>{data.patientName}</Text>
            </View>
            <View style={{ flex: 1, borderBottom: 1, borderBottomColor: '#000', paddingVertical: 5, paddingHorizontal: 5, minHeight: 32 }}>
              <Text style={styles.fieldLabel}>Patient date of birth</Text>
              <Text style={styles.fieldValue}>{data.patientDob}</Text>
            </View>
          </View>

          {/* Row 3: Address | City | State/ZIP */}
          <View style={styles.tableRow}>
            <View style={styles.cellThird}>
              <Text style={styles.fieldLabel}>Address</Text>
              <Text style={styles.fieldValue}>{data.address}</Text>
            </View>
            <View style={styles.cellThird}>
              <Text style={styles.fieldLabel}>City</Text>
              <Text style={styles.fieldValue}>{data.city}</Text>
            </View>
            <View style={styles.cellThirdLast}>
              <Text style={styles.fieldLabel}>State/ZIP code</Text>
              <Text style={styles.fieldValue}>{data.stateZip}</Text>
            </View>
          </View>

          {/* Section 2 - Comments */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>Section 2 - Comments</Text>
          </View>
          <Text style={styles.commentsLabel}>Description/explanation of claim:</Text>
          <View style={{ borderBottom: 1, borderBottomColor: '#000', minHeight: 90, paddingHorizontal: 5, paddingBottom: 5 }}>
            <Text style={styles.commentsArea}>{buildCommentText(data)}</Text>
          </View>

          {/* Sections 3 + 4 — kept together; if comments have consumed enough space
              that less than 250pt remains on the current page, react-pdf breaks
              these sections to a new page (left/right border lines continue). */}
          <View minPresenceAhead={250}>

            {/* Section 3 - Signature */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Section 3 - Signature</Text>
            </View>
            <Text style={styles.sigStatement}>
              The above statements and attachments are true and complete to the best of my knowledge.
            </Text>
            {/* wrap={false} prevents the signature row itself from splitting mid-row */}
            <View wrap={false} style={styles.signatureRow}>
              <View style={styles.signatureCell}>
                <Text style={styles.signatureXLabel}>X</Text>
                {data.signatureData ? (
                  <Image src={data.signatureData} style={styles.signatureImg} />
                ) : (
                  <View style={{ borderBottom: 1, borderBottomColor: '#000', width: 200, marginTop: 12 }} />
                )}
                <Text style={styles.signatureLabel}>Signature</Text>
              </View>
              <View style={styles.dateCell}>
                <Text style={styles.dateLabel}>Date</Text>
                <Text style={styles.dateValue}>{data.signatureDate}</Text>
              </View>
            </View>

            {/* Section 4 - Instructions */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Section 4 - Instructions</Text>
            </View>
            <View style={styles.instrRow}>
              <View style={styles.instrLeft}>
                <Text style={styles.instrBold}>Fax to : 1-866-637-4972</Text>
                <Text style={styles.instrText}>Or</Text>
                <Text style={styles.instrText}>Mail to:</Text>
                <Text style={styles.instrBold}>Member Reimbursements - G802</Text>
                <Text style={styles.instrBold}>Blue Care Network</Text>
                <Text style={styles.instrBold}>P.O. Box 68767</Text>
                <Text style={styles.instrBold}>Grand Rapids, MI 49516-8767</Text>
              </View>
              <View style={styles.instrRight}>
                <Text style={styles.instrBold}>Questions? Call Customer Service</Text>
                <Text style={styles.instrBold}>1-800-662-6667</Text>
                <Text style={styles.instrBold}>1-800-257-9980 (TTY users)</Text>
                <Text style={styles.instrBold}>8 a.m. to 5:30 p.m. Monday through Friday</Text>
              </View>
            </View>

            <Text style={styles.keepCopy}>
              Please keep a copy of all documents you send us. Allow 30 days for processing
            </Text>

          </View>{/* end minPresenceAhead wrapper */}

        </View>

        {/* Footer form number */}
        <Text style={styles.pageFooter}>DF 16006 JUL 16</Text>

      </Page>
    </Document>
  );
}
