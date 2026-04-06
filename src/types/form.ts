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
  signatureDate: new Date().toISOString().split('T')[0],
};
