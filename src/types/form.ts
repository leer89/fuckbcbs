export interface FormData {
  email: string;
  enrolleeId: string;
  enrolleeName: string;
  patientName: string;
  patientDob: string;
  address: string;
  city: string;
  stateZip: string;
  claimDescription: string;
  signatureData: string;
  receipts?: string[]; // data URLs or storage paths
  urgentCareLocation?: string; // selected Michigan urgent care location
  selectedMedicalCodes?: string[]; // selected procedure codes
  signatureDate: string;
}

export const initialFormData: FormData = {
  email: '',
  enrolleeId: '',
  enrolleeName: '',
  patientName: '',
  patientDob: '',
  address: '',
  city: '',
  stateZip: '',
  claimDescription: '',
  signatureData: '',
  receipts: [],
  urgentCareLocation: '',
  selectedMedicalCodes: [],
  signatureDate: new Date().toISOString().split('T')[0],
};
