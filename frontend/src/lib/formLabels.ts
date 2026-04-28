export const FIELD_LABELS: Record<string, string> = {
  centre_name: 'Centre Name',
  operator_company_name: 'Operator / Company Name',
  uen: 'UEN',
  contact_person: 'Contact Person',
  contact_email: 'Contact Email',
  contact_phone: 'Contact Phone',
  centre_address: 'Centre Address',
  type_of_service: 'Type of Service',
  proposed_capacity: 'Proposed Capacity',
  compliance_confirmed: 'Compliance Declaration',
}

export const SECTION_LABELS: Record<string, string> = {
  basic_details: 'Basic Details',
  operations: 'Operations',
  documents: 'Documents',
  declarations: 'Declarations',
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  staff_qualification: 'Staff Qualification Certificate(s)',
  fire_safety: 'Fire Safety Certificate',
  floor_plan: 'Floor Plan of Premises',
  insurance: 'Insurance Certificate',
}

export const SECTION_ORDER = ['basic_details', 'operations', 'declarations']
export const DOC_TYPE_ORDER = ['staff_qualification', 'fire_safety', 'floor_plan', 'insurance']
export const OPTIONAL_DOC_TYPES = new Set(['insurance'])
