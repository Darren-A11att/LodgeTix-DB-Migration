# MongoDB Forms and Registration Patterns

This document explores various patterns and best practices for handling forms and registrations in MongoDB, with practical examples for each pattern.

## Table of Contents
1. [Dynamic Form Schema Patterns](#dynamic-form-schema-patterns)
2. [Multi-step Registration Flows](#multi-step-registration-flows)
3. [Form Validation Patterns](#form-validation-patterns)
4. [File Upload Handling](#file-upload-handling)
5. [Conditional Logic in Forms](#conditional-logic-in-forms)
6. [Form Versioning and Migrations](#form-versioning-and-migrations)
7. [Partial Submission Handling](#partial-submission-handling)
8. [Team/Group Registration Patterns](#team-group-registration-patterns)
9. [Approval Workflow Patterns](#approval-workflow-patterns)
10. [Form Analytics and Tracking](#form-analytics-and-tracking)

---

## 1. Dynamic Form Schema Patterns

Dynamic forms allow flexible field definitions that can be configured without code changes.

### Schema Design

```javascript
// Form Definition Collection
{
  _id: ObjectId("..."),
  formId: "event-registration-2024",
  version: 1,
  title: "Event Registration Form",
  fields: [
    {
      fieldId: "firstName",
      type: "text",
      label: "First Name",
      required: true,
      validation: {
        minLength: 2,
        maxLength: 50,
        pattern: "^[a-zA-Z\\s]+$"
      }
    },
    {
      fieldId: "email",
      type: "email",
      label: "Email Address",
      required: true,
      validation: {
        pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$"
      }
    },
    {
      fieldId: "attendeeType",
      type: "select",
      label: "Attendee Type",
      options: [
        { value: "speaker", label: "Speaker" },
        { value: "attendee", label: "Regular Attendee" },
        { value: "sponsor", label: "Sponsor" }
      ],
      required: true
    },
    {
      fieldId: "dietaryRestrictions",
      type: "checkbox-group",
      label: "Dietary Restrictions",
      options: [
        { value: "vegetarian", label: "Vegetarian" },
        { value: "vegan", label: "Vegan" },
        { value: "gluten-free", label: "Gluten Free" },
        { value: "other", label: "Other" }
      ]
    }
  ],
  createdAt: ISODate("2024-01-01"),
  updatedAt: ISODate("2024-01-15")
}

// Form Submission Collection
{
  _id: ObjectId("..."),
  formId: "event-registration-2024",
  formVersion: 1,
  submittedData: {
    firstName: "John",
    email: "john@example.com",
    attendeeType: "speaker",
    dietaryRestrictions: ["vegetarian", "gluten-free"]
  },
  submittedAt: ISODate("2024-02-01"),
  userId: ObjectId("...")
}
```

### Implementation Example

```javascript
// Form renderer service
class DynamicFormService {
  async getFormDefinition(formId) {
    return await db.collection('formDefinitions').findOne({ formId });
  }

  async validateSubmission(formId, submissionData) {
    const form = await this.getFormDefinition(formId);
    const errors = {};

    for (const field of form.fields) {
      const value = submissionData[field.fieldId];
      
      // Required field validation
      if (field.required && !value) {
        errors[field.fieldId] = `${field.label} is required`;
        continue;
      }

      // Type-specific validation
      if (value && field.validation) {
        if (field.validation.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            errors[field.fieldId] = `${field.label} format is invalid`;
          }
        }
      }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}
```

## 2. Multi-step Registration Flows

Handle complex registrations that span multiple pages or steps.

### Schema Design

```javascript
// Registration Session Collection
{
  _id: ObjectId("..."),
  sessionId: "reg-session-abc123",
  formId: "conference-registration",
  userId: ObjectId("..."),
  currentStep: 2,
  totalSteps: 4,
  steps: {
    1: {
      name: "Personal Information",
      completed: true,
      data: {
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah@example.com",
        phone: "+1234567890"
      },
      completedAt: ISODate("2024-03-01T10:00:00Z")
    },
    2: {
      name: "Professional Details",
      completed: false,
      data: {
        company: "Tech Corp",
        jobTitle: "Senior Developer"
        // Partial data saved
      },
      lastUpdated: ISODate("2024-03-01T10:05:00Z")
    }
  },
  expiresAt: ISODate("2024-03-02T10:00:00Z"),
  metadata: {
    userAgent: "Mozilla/5.0...",
    ipAddress: "192.168.1.1"
  }
}

// Completed Registration Collection
{
  _id: ObjectId("..."),
  registrationId: "REG-2024-0001",
  formId: "conference-registration",
  userId: ObjectId("..."),
  personalInfo: {
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah@example.com",
    phone: "+1234567890"
  },
  professionalDetails: {
    company: "Tech Corp",
    jobTitle: "Senior Developer",
    yearsExperience: 8
  },
  eventPreferences: {
    workshops: ["AI-101", "Cloud-202"],
    mealPreference: "vegetarian"
  },
  payment: {
    amount: 299.00,
    method: "credit_card",
    transactionId: "txn_123456"
  },
  completedAt: ISODate("2024-03-01T10:30:00Z"),
  confirmationSent: true
}
```

### Implementation Example

```javascript
class MultiStepRegistrationService {
  async saveStepData(sessionId, stepNumber, data) {
    const updatePath = `steps.${stepNumber}`;
    
    return await db.collection('registrationSessions').updateOne(
      { sessionId },
      {
        $set: {
          [`${updatePath}.data`]: data,
          [`${updatePath}.lastUpdated`]: new Date(),
          currentStep: stepNumber
        }
      },
      { upsert: true }
    );
  }

  async completeStep(sessionId, stepNumber) {
    return await db.collection('registrationSessions').updateOne(
      { sessionId },
      {
        $set: {
          [`steps.${stepNumber}.completed`]: true,
          [`steps.${stepNumber}.completedAt`]: new Date()
        }
      }
    );
  }

  async finalizeRegistration(sessionId) {
    const session = await db.collection('registrationSessions').findOne({ sessionId });
    
    // Validate all steps are complete
    const allStepsComplete = Object.values(session.steps).every(step => step.completed);
    if (!allStepsComplete) {
      throw new Error('All steps must be completed');
    }

    // Create final registration
    const registration = {
      registrationId: generateRegistrationId(),
      formId: session.formId,
      userId: session.userId,
      ...this.mergeStepData(session.steps),
      completedAt: new Date()
    };

    await db.collection('registrations').insertOne(registration);
    await db.collection('registrationSessions').deleteOne({ sessionId });
    
    return registration;
  }
}
```

## 3. Form Validation Patterns

Implement comprehensive validation at both client and server levels.

### Schema Design

```javascript
// Validation Rules Collection
{
  _id: ObjectId("..."),
  formId: "membership-application",
  validationRules: [
    {
      fieldId: "age",
      rules: [
        {
          type: "required",
          message: "Age is required"
        },
        {
          type: "min",
          value: 18,
          message: "Must be 18 or older"
        },
        {
          type: "max",
          value: 120,
          message: "Please enter a valid age"
        }
      ]
    },
    {
      fieldId: "email",
      rules: [
        {
          type: "required",
          message: "Email is required"
        },
        {
          type: "email",
          message: "Please enter a valid email"
        },
        {
          type: "unique",
          collection: "users",
          field: "email",
          message: "Email already registered"
        }
      ]
    },
    {
      fieldId: "password",
      rules: [
        {
          type: "required",
          message: "Password is required"
        },
        {
          type: "minLength",
          value: 8,
          message: "Password must be at least 8 characters"
        },
        {
          type: "pattern",
          value: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*$",
          message: "Password must contain uppercase, lowercase, and number"
        }
      ]
    },
    {
      fieldId: "confirmPassword",
      rules: [
        {
          type: "matches",
          field: "password",
          message: "Passwords must match"
        }
      ]
    }
  ],
  crossFieldValidation: [
    {
      type: "conditional",
      condition: {
        field: "membershipType",
        value: "student"
      },
      then: {
        field: "studentId",
        rules: [
          {
            type: "required",
            message: "Student ID required for student membership"
          }
        ]
      }
    }
  ]
}
```

### Implementation Example

```javascript
class FormValidator {
  async validate(formId, data) {
    const rules = await db.collection('validationRules').findOne({ formId });
    const errors = {};

    // Field-level validation
    for (const fieldRule of rules.validationRules) {
      const fieldErrors = await this.validateField(fieldRule, data[fieldRule.fieldId], data);
      if (fieldErrors.length > 0) {
        errors[fieldRule.fieldId] = fieldErrors;
      }
    }

    // Cross-field validation
    for (const crossRule of rules.crossFieldValidation || []) {
      const crossErrors = await this.validateCrossField(crossRule, data);
      Object.assign(errors, crossErrors);
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  async validateField(fieldRule, value, allData) {
    const errors = [];

    for (const rule of fieldRule.rules) {
      switch (rule.type) {
        case 'required':
          if (!value || value === '') {
            errors.push(rule.message);
          }
          break;

        case 'unique':
          const existing = await db.collection(rule.collection).findOne({
            [rule.field]: value
          });
          if (existing) {
            errors.push(rule.message);
          }
          break;

        case 'matches':
          if (value !== allData[rule.field]) {
            errors.push(rule.message);
          }
          break;

        case 'pattern':
          const regex = new RegExp(rule.value);
          if (!regex.test(value)) {
            errors.push(rule.message);
          }
          break;
      }
    }

    return errors;
  }
}
```

## 4. File Upload Handling

Manage file uploads with metadata and references in MongoDB.

### Schema Design

```javascript
// File Uploads Collection
{
  _id: ObjectId("..."),
  uploadId: "upload-123456",
  filename: "resume.pdf",
  originalName: "John_Doe_Resume_2024.pdf",
  mimeType: "application/pdf",
  size: 524288, // bytes
  storageLocation: {
    provider: "s3",
    bucket: "form-uploads",
    key: "registrations/2024/03/upload-123456.pdf",
    region: "us-east-1"
  },
  metadata: {
    formId: "job-application",
    fieldId: "resume",
    submissionId: ObjectId("..."),
    userId: ObjectId("...")
  },
  uploadedAt: ISODate("2024-03-15T14:30:00Z"),
  status: "completed",
  virusScanStatus: "clean",
  virusScannedAt: ISODate("2024-03-15T14:30:30Z")
}

// Registration with File References
{
  _id: ObjectId("..."),
  formId: "job-application",
  applicantInfo: {
    name: "John Doe",
    email: "john@example.com"
  },
  documents: {
    resume: {
      uploadId: "upload-123456",
      filename: "resume.pdf",
      uploadedAt: ISODate("2024-03-15T14:30:00Z")
    },
    coverLetter: {
      uploadId: "upload-123457",
      filename: "cover-letter.pdf",
      uploadedAt: ISODate("2024-03-15T14:31:00Z")
    },
    portfolio: [
      {
        uploadId: "upload-123458",
        filename: "project1.jpg",
        uploadedAt: ISODate("2024-03-15T14:32:00Z")
      },
      {
        uploadId: "upload-123459",
        filename: "project2.jpg",
        uploadedAt: ISODate("2024-03-15T14:33:00Z")
      }
    ]
  }
}
```

### Implementation Example

```javascript
class FileUploadService {
  async handleUpload(file, metadata) {
    const uploadId = generateUploadId();
    
    // Store file metadata
    const fileDoc = {
      uploadId,
      filename: sanitizeFilename(file.originalname),
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageLocation: {
        provider: 's3',
        bucket: process.env.UPLOAD_BUCKET,
        key: `registrations/${new Date().getFullYear()}/${uploadId}`,
        region: process.env.AWS_REGION
      },
      metadata,
      uploadedAt: new Date(),
      status: 'pending'
    };

    await db.collection('fileUploads').insertOne(fileDoc);

    // Upload to storage
    try {
      await this.uploadToS3(file, fileDoc.storageLocation);
      
      // Update status
      await db.collection('fileUploads').updateOne(
        { uploadId },
        { $set: { status: 'completed' } }
      );

      // Trigger virus scan
      await this.queueVirusScan(uploadId);

      return fileDoc;
    } catch (error) {
      await db.collection('fileUploads').updateOne(
        { uploadId },
        { $set: { status: 'failed', error: error.message } }
      );
      throw error;
    }
  }

  async validateFileRequirements(file, requirements) {
    const errors = [];

    if (requirements.maxSize && file.size > requirements.maxSize) {
      errors.push(`File size must not exceed ${requirements.maxSize / 1024 / 1024}MB`);
    }

    if (requirements.allowedTypes && !requirements.allowedTypes.includes(file.mimetype)) {
      errors.push(`File type must be one of: ${requirements.allowedTypes.join(', ')}`);
    }

    return errors;
  }
}
```

## 5. Conditional Logic in Forms

Implement dynamic form behavior based on user inputs.

### Schema Design

```javascript
// Form with Conditional Logic
{
  _id: ObjectId("..."),
  formId: "insurance-application",
  fields: [
    {
      fieldId: "insuranceType",
      type: "select",
      label: "Insurance Type",
      options: ["health", "life", "auto", "home"],
      required: true
    },
    {
      fieldId: "vehicleInfo",
      type: "group",
      label: "Vehicle Information",
      visibility: {
        condition: "insuranceType",
        operator: "equals",
        value: "auto"
      },
      fields: [
        {
          fieldId: "vehicleMake",
          type: "text",
          label: "Make",
          required: true
        },
        {
          fieldId: "vehicleModel",
          type: "text",
          label: "Model",
          required: true
        },
        {
          fieldId: "vehicleYear",
          type: "number",
          label: "Year",
          required: true
        }
      ]
    },
    {
      fieldId: "healthConditions",
      type: "checkbox-group",
      label: "Pre-existing Conditions",
      visibility: {
        condition: "insuranceType",
        operator: "in",
        value: ["health", "life"]
      },
      options: ["diabetes", "heart-disease", "cancer", "none"]
    },
    {
      fieldId: "smokingStatus",
      type: "radio",
      label: "Do you smoke?",
      options: ["yes", "no"],
      visibility: {
        condition: "insuranceType",
        operator: "equals",
        value: "life"
      }
    },
    {
      fieldId: "additionalCoverage",
      type: "number",
      label: "Additional Coverage Amount",
      visibility: {
        conditions: [
          {
            field: "insuranceType",
            operator: "equals",
            value: "life"
          },
          {
            field: "smokingStatus",
            operator: "equals",
            value: "no"
          }
        ],
        logic: "AND"
      }
    }
  ],
  calculations: [
    {
      fieldId: "estimatedPremium",
      type: "calculated",
      formula: {
        base: 100,
        modifiers: [
          {
            condition: {
              field: "insuranceType",
              operator: "equals",
              value: "auto"
            },
            multiplier: 1.5
          },
          {
            condition: {
              field: "smokingStatus",
              operator: "equals",
              value: "yes"
            },
            multiplier: 2.0
          }
        ]
      }
    }
  ]
}
```

### Implementation Example

```javascript
class ConditionalFormEngine {
  evaluateVisibility(field, formData) {
    if (!field.visibility) return true;

    if (field.visibility.condition) {
      // Single condition
      return this.evaluateCondition(
        field.visibility.condition,
        field.visibility.operator,
        field.visibility.value,
        formData
      );
    } else if (field.visibility.conditions) {
      // Multiple conditions
      const results = field.visibility.conditions.map(condition =>
        this.evaluateCondition(
          condition.field,
          condition.operator,
          condition.value,
          formData
        )
      );

      return field.visibility.logic === 'AND'
        ? results.every(r => r)
        : results.some(r => r);
    }
  }

  evaluateCondition(fieldName, operator, expectedValue, formData) {
    const actualValue = formData[fieldName];

    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;
      case 'not_equals':
        return actualValue !== expectedValue;
      case 'in':
        return expectedValue.includes(actualValue);
      case 'contains':
        return actualValue && actualValue.includes(expectedValue);
      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);
      case 'less_than':
        return Number(actualValue) < Number(expectedValue);
      default:
        return true;
    }
  }

  calculateFields(formDefinition, formData) {
    const calculations = {};

    for (const calc of formDefinition.calculations || []) {
      let value = calc.formula.base;

      for (const modifier of calc.formula.modifiers) {
        if (this.evaluateCondition(
          modifier.condition.field,
          modifier.condition.operator,
          modifier.condition.value,
          formData
        )) {
          if (modifier.multiplier) {
            value *= modifier.multiplier;
          } else if (modifier.addition) {
            value += modifier.addition;
          }
        }
      }

      calculations[calc.fieldId] = value;
    }

    return calculations;
  }
}
```

## 6. Form Versioning and Migrations

Handle form evolution over time while maintaining data integrity.

### Schema Design

```javascript
// Form Version History
{
  _id: ObjectId("..."),
  formId: "customer-survey",
  versions: [
    {
      version: 1,
      activeFrom: ISODate("2024-01-01"),
      activeTo: ISODate("2024-06-30"),
      fields: [
        { fieldId: "name", type: "text", label: "Name" },
        { fieldId: "email", type: "email", label: "Email" },
        { fieldId: "satisfaction", type: "rating", max: 5 }
      ]
    },
    {
      version: 2,
      activeFrom: ISODate("2024-07-01"),
      activeTo: null, // Current version
      fields: [
        { fieldId: "firstName", type: "text", label: "First Name" },
        { fieldId: "lastName", type: "text", label: "Last Name" },
        { fieldId: "email", type: "email", label: "Email" },
        { fieldId: "satisfaction", type: "rating", max: 10 }, // Changed scale
        { fieldId: "comments", type: "textarea", label: "Comments" } // New field
      ],
      migrations: [
        {
          fromVersion: 1,
          fieldMappings: [
            {
              from: "name",
              to: ["firstName", "lastName"],
              transform: "splitName"
            },
            {
              from: "satisfaction",
              to: "satisfaction",
              transform: "scaleRating",
              params: { fromMax: 5, toMax: 10 }
            }
          ]
        }
      ]
    }
  ]
}

// Submission with Version Info
{
  _id: ObjectId("..."),
  formId: "customer-survey",
  formVersion: 1,
  submittedData: {
    name: "John Doe",
    email: "john@example.com",
    satisfaction: 4
  },
  submittedAt: ISODate("2024-05-15"),
  migratedVersions: [2], // Track which versions this has been migrated to
  migrationHistory: [
    {
      toVersion: 2,
      migratedAt: ISODate("2024-07-15"),
      changes: {
        "name": { 
          old: "John Doe", 
          new: { firstName: "John", lastName: "Doe" }
        },
        "satisfaction": {
          old: 4,
          new: 8
        }
      }
    }
  ]
}
```

### Implementation Example

```javascript
class FormVersionManager {
  async migrateSubmission(submissionId, targetVersion) {
    const submission = await db.collection('submissions').findOne({ _id: submissionId });
    const formDef = await db.collection('formVersions').findOne({ formId: submission.formId });
    
    if (submission.formVersion >= targetVersion) {
      return submission; // Already at or above target version
    }

    let migratedData = { ...submission.submittedData };
    const changes = {};

    // Apply migrations sequentially
    for (let v = submission.formVersion + 1; v <= targetVersion; v++) {
      const versionDef = formDef.versions.find(ver => ver.version === v);
      const migration = versionDef.migrations.find(m => m.fromVersion === v - 1);
      
      if (migration) {
        const result = await this.applyMigration(migratedData, migration);
        migratedData = result.data;
        Object.assign(changes, result.changes);
      }
    }

    // Update submission
    await db.collection('submissions').updateOne(
      { _id: submissionId },
      {
        $set: {
          submittedData: migratedData,
          formVersion: targetVersion
        },
        $push: {
          migratedVersions: targetVersion,
          migrationHistory: {
            toVersion: targetVersion,
            migratedAt: new Date(),
            changes
          }
        }
      }
    );

    return { ...submission, submittedData: migratedData, formVersion: targetVersion };
  }

  async applyMigration(data, migration) {
    const newData = { ...data };
    const changes = {};

    for (const mapping of migration.fieldMappings) {
      const oldValue = data[mapping.from];
      let newValue;

      switch (mapping.transform) {
        case 'splitName':
          const parts = oldValue.split(' ');
          newValue = {
            firstName: parts[0],
            lastName: parts.slice(1).join(' ')
          };
          newData[mapping.to[0]] = newValue.firstName;
          newData[mapping.to[1]] = newValue.lastName;
          delete newData[mapping.from];
          break;

        case 'scaleRating':
          const ratio = mapping.params.toMax / mapping.params.fromMax;
          newValue = Math.round(oldValue * ratio);
          newData[mapping.to] = newValue;
          break;

        default:
          newValue = oldValue;
          newData[mapping.to] = newValue;
      }

      changes[mapping.from] = { old: oldValue, new: newValue };
    }

    return { data: newData, changes };
  }
}
```

## 7. Partial Submission Handling

Save progress and resume incomplete forms.

### Schema Design

```javascript
// Draft Submissions Collection
{
  _id: ObjectId("..."),
  draftId: "draft-abc123",
  formId: "complex-application",
  userId: ObjectId("..."),
  status: "in_progress", // in_progress, abandoned, completed
  progress: {
    totalFields: 25,
    completedFields: 15,
    percentComplete: 60,
    lastFieldCompleted: "education.degree"
  },
  data: {
    personalInfo: {
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.com"
      // phone field not filled yet
    },
    education: {
      degree: "Bachelor's",
      // university field not filled yet
    }
  },
  validation: {
    errors: {
      "personalInfo.phone": "Required field",
      "education.university": "Required field"
    },
    lastValidated: ISODate("2024-03-20T15:30:00Z")
  },
  autoSaveHistory: [
    {
      timestamp: ISODate("2024-03-20T15:25:00Z"),
      fieldsUpdated: ["personalInfo.firstName", "personalInfo.lastName"]
    },
    {
      timestamp: ISODate("2024-03-20T15:28:00Z"),
      fieldsUpdated: ["personalInfo.email"]
    }
  ],
  createdAt: ISODate("2024-03-20T15:20:00Z"),
  lastUpdated: ISODate("2024-03-20T15:30:00Z"),
  expiresAt: ISODate("2024-04-20T15:20:00Z") // 30 days
}

// Resume Token Collection
{
  _id: ObjectId("..."),
  token: "resume-token-xyz789",
  draftId: "draft-abc123",
  email: "alice@example.com",
  createdAt: ISODate("2024-03-20T16:00:00Z"),
  expiresAt: ISODate("2024-03-27T16:00:00Z"), // 7 days
  used: false
}
```

### Implementation Example

```javascript
class PartialSubmissionService {
  async autoSave(formId, userId, fieldUpdates) {
    const draftId = await this.getOrCreateDraft(formId, userId);
    
    // Merge field updates
    const updateObj = {};
    const fieldsUpdated = [];
    
    for (const [fieldPath, value] of Object.entries(fieldUpdates)) {
      updateObj[`data.${fieldPath}`] = value;
      fieldsUpdated.push(fieldPath);
    }

    // Update draft
    await db.collection('draftSubmissions').updateOne(
      { draftId },
      {
        $set: {
          ...updateObj,
          lastUpdated: new Date()
        },
        $push: {
          autoSaveHistory: {
            timestamp: new Date(),
            fieldsUpdated
          }
        }
      }
    );

    // Update progress
    await this.updateProgress(draftId);
    
    return { draftId, saved: true };
  }

  async updateProgress(draftId) {
    const draft = await db.collection('draftSubmissions').findOne({ draftId });
    const formDef = await db.collection('forms').findOne({ formId: draft.formId });
    
    // Calculate completed fields
    const completedFields = this.countCompletedFields(draft.data, formDef.fields);
    const totalFields = this.countTotalFields(formDef.fields);
    
    await db.collection('draftSubmissions').updateOne(
      { draftId },
      {
        $set: {
          'progress.completedFields': completedFields,
          'progress.totalFields': totalFields,
          'progress.percentComplete': Math.round((completedFields / totalFields) * 100)
        }
      }
    );
  }

  async sendResumeLink(draftId) {
    const draft = await db.collection('draftSubmissions').findOne({ draftId });
    
    // Generate secure token
    const token = generateSecureToken();
    
    await db.collection('resumeTokens').insertOne({
      token,
      draftId,
      email: draft.data.personalInfo.email,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      used: false
    });

    // Send email with resume link
    await emailService.send({
      to: draft.data.personalInfo.email,
      subject: 'Resume Your Application',
      template: 'resume-form',
      data: {
        resumeLink: `${process.env.APP_URL}/resume?token=${token}`,
        progress: draft.progress.percentComplete
      }
    });
  }

  async resumeFromToken(token) {
    const tokenDoc = await db.collection('resumeTokens').findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenDoc) {
      throw new Error('Invalid or expired token');
    }

    // Mark token as used
    await db.collection('resumeTokens').updateOne(
      { token },
      { $set: { used: true, usedAt: new Date() } }
    );

    // Return draft data
    return await db.collection('draftSubmissions').findOne({ draftId: tokenDoc.draftId });
  }
}
```

## 8. Team/Group Registration Patterns

Handle registrations for multiple participants as a group.

### Schema Design

```javascript
// Team Registration Collection
{
  _id: ObjectId("..."),
  registrationId: "team-reg-2024-001",
  eventId: "hackathon-2024",
  teamInfo: {
    name: "Code Warriors",
    category: "professional",
    size: 4,
    maxSize: 5
  },
  primaryContact: {
    userId: ObjectId("..."),
    name: "John Leader",
    email: "john@team.com",
    phone: "+1234567890"
  },
  members: [
    {
      memberId: ObjectId("..."),
      role: "leader",
      status: "confirmed",
      joinedAt: ISODate("2024-04-01T10:00:00Z"),
      personalInfo: {
        name: "John Leader",
        email: "john@team.com",
        tshirtSize: "L"
      }
    },
    {
      memberId: ObjectId("..."),
      role: "member",
      status: "confirmed",
      joinedAt: ISODate("2024-04-01T14:00:00Z"),
      personalInfo: {
        name: "Jane Developer",
        email: "jane@team.com",
        tshirtSize: "M"
      }
    },
    {
      memberId: ObjectId("..."),
      role: "member",
      status: "pending",
      invitedAt: ISODate("2024-04-02T09:00:00Z"),
      invitationToken: "invite-token-xyz",
      invitedEmail: "bob@example.com"
    }
  ],
  teamPreferences: {
    projectCategory: "AI/ML",
    presentationSlot: "afternoon",
    dietaryRestrictions: ["vegetarian", "gluten-free"]
  },
  payment: {
    type: "team", // team or individual
    totalAmount: 400,
    paidAmount: 300,
    payments: [
      {
        memberId: ObjectId("..."),
        amount: 100,
        paidAt: ISODate("2024-04-01T10:30:00Z"),
        method: "credit_card"
      },
      {
        memberId: ObjectId("..."),
        amount: 100,
        paidAt: ISODate("2024-04-01T14:30:00Z"),
        method: "paypal"
      },
      {
        memberId: ObjectId("..."),
        amount: 100,
        paidAt: ISODate("2024-04-02T11:00:00Z"),
        method: "credit_card"
      }
    ]
  },
  status: "partial", // draft, partial, complete, cancelled
  createdAt: ISODate("2024-04-01T10:00:00Z"),
  updatedAt: ISODate("2024-04-02T11:00:00Z")
}

// Team Invitation Collection
{
  _id: ObjectId("..."),
  token: "invite-token-xyz",
  teamId: ObjectId("..."),
  registrationId: "team-reg-2024-001",
  invitedEmail: "bob@example.com",
  invitedBy: ObjectId("..."),
  status: "pending", // pending, accepted, declined, expired
  createdAt: ISODate("2024-04-02T09:00:00Z"),
  expiresAt: ISODate("2024-04-09T09:00:00Z"),
  metadata: {
    teamName: "Code Warriors",
    eventName: "Hackathon 2024",
    role: "member"
  }
}
```

### Implementation Example

```javascript
class TeamRegistrationService {
  async createTeam(eventId, teamData, creatorInfo) {
    const registrationId = generateTeamRegistrationId();
    
    const teamRegistration = {
      registrationId,
      eventId,
      teamInfo: {
        name: teamData.name,
        category: teamData.category,
        size: 1,
        maxSize: teamData.maxSize || 5
      },
      primaryContact: {
        userId: creatorInfo.userId,
        name: creatorInfo.name,
        email: creatorInfo.email,
        phone: creatorInfo.phone
      },
      members: [
        {
          memberId: new ObjectId(),
          userId: creatorInfo.userId,
          role: "leader",
          status: "confirmed",
          joinedAt: new Date(),
          personalInfo: creatorInfo
        }
      ],
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('teamRegistrations').insertOne(teamRegistration);
    return teamRegistration;
  }

  async inviteMember(registrationId, inviterUserId, inviteeEmail) {
    const team = await db.collection('teamRegistrations').findOne({ registrationId });
    
    // Check team capacity
    if (team.members.length >= team.teamInfo.maxSize) {
      throw new Error('Team is at maximum capacity');
    }

    // Check if already invited/member
    const existingMember = team.members.find(m => 
      m.personalInfo?.email === inviteeEmail || m.invitedEmail === inviteeEmail
    );
    if (existingMember) {
      throw new Error('User already invited or member of team');
    }

    // Create invitation
    const invitationToken = generateInvitationToken();
    const invitation = {
      token: invitationToken,
      teamId: team._id,
      registrationId,
      invitedEmail: inviteeEmail,
      invitedBy: inviterUserId,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      metadata: {
        teamName: team.teamInfo.name,
        eventName: team.eventId,
        role: 'member'
      }
    };

    await db.collection('teamInvitations').insertOne(invitation);

    // Add pending member to team
    await db.collection('teamRegistrations').updateOne(
      { registrationId },
      {
        $push: {
          members: {
            memberId: new ObjectId(),
            role: 'member',
            status: 'pending',
            invitedAt: new Date(),
            invitationToken,
            invitedEmail: inviteeEmail
          }
        },
        $inc: { 'teamInfo.size': 1 },
        $set: { updatedAt: new Date() }
      }
    );

    // Send invitation email
    await this.sendInvitationEmail(inviteeEmail, invitation);
    
    return invitation;
  }

  async acceptInvitation(token, userInfo) {
    const invitation = await db.collection('teamInvitations').findOne({
      token,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    // Update invitation status
    await db.collection('teamInvitations').updateOne(
      { token },
      {
        $set: {
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedBy: userInfo.userId
        }
      }
    );

    // Update team member status
    await db.collection('teamRegistrations').updateOne(
      {
        registrationId: invitation.registrationId,
        'members.invitationToken': token
      },
      {
        $set: {
          'members.$.status': 'confirmed',
          'members.$.joinedAt': new Date(),
          'members.$.personalInfo': userInfo,
          'members.$.userId': userInfo.userId,
          updatedAt: new Date()
        },
        $unset: {
          'members.$.invitationToken': '',
          'members.$.invitedEmail': ''
        }
      }
    );

    return { success: true, teamId: invitation.teamId };
  }

  async calculateTeamPayment(registrationId) {
    const team = await db.collection('teamRegistrations').findOne({ registrationId });
    const event = await db.collection('events').findOne({ eventId: team.eventId });
    
    const confirmedMembers = team.members.filter(m => m.status === 'confirmed').length;
    const pricePerMember = event.pricing[team.teamInfo.category] || event.pricing.default;
    
    const totalAmount = confirmedMembers * pricePerMember;
    const paidAmount = team.payment?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    
    return {
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      pricePerMember,
      confirmedMembers
    };
  }
}
```

## 9. Approval Workflow Patterns

Implement multi-stage approval processes for form submissions.

### Schema Design

```javascript
// Workflow Definition Collection
{
  _id: ObjectId("..."),
  workflowId: "grant-application-workflow",
  name: "Grant Application Approval",
  stages: [
    {
      stageId: "initial-review",
      name: "Initial Review",
      order: 1,
      approvers: {
        type: "role", // role, specific_users, dynamic
        value: "grant_reviewer"
      },
      actions: ["approve", "reject", "request_info"],
      sla: {
        duration: 5,
        unit: "days",
        escalateTo: "grant_manager"
      },
      autoApproveConditions: [
        {
          field: "requestedAmount",
          operator: "less_than",
          value: 5000
        }
      ]
    },
    {
      stageId: "department-review",
      name: "Department Review",
      order: 2,
      approvers: {
        type: "dynamic",
        value: "submission.department.head"
      },
      actions: ["approve", "reject", "refer_to_committee"],
      requiredFields: ["budgetJustification", "impactStatement"]
    },
    {
      stageId: "final-approval",
      name: "Final Approval",
      order: 3,
      approvers: {
        type: "specific_users",
        value: [ObjectId("..."), ObjectId("...")] // User IDs
      },
      actions: ["approve", "reject"],
      requireAllApprovers: true
    }
  ],
  notifications: {
    onSubmit: ["applicant", "initial_reviewer"],
    onApprove: ["applicant", "next_approver"],
    onReject: ["applicant"],
    onComplete: ["applicant", "finance_team"]
  }
}

// Submission with Workflow State
{
  _id: ObjectId("..."),
  submissionId: "GRANT-2024-0001",
  formId: "grant-application",
  workflowId: "grant-application-workflow",
  submittedBy: ObjectId("..."),
  submittedAt: ISODate("2024-05-01T10:00:00Z"),
  data: {
    projectTitle: "Community Health Initiative",
    requestedAmount: 25000,
    department: {
      id: "health-dept",
      head: ObjectId("...")
    },
    description: "...",
    budgetJustification: "...",
    impactStatement: "..."
  },
  workflowState: {
    status: "in_progress", // draft, in_progress, approved, rejected, on_hold
    currentStage: "department-review",
    currentStageStarted: ISODate("2024-05-03T14:00:00Z"),
    history: [
      {
        stageId: "initial-review",
        status: "approved",
        reviewedBy: ObjectId("..."),
        reviewedAt: ISODate("2024-05-03T14:00:00Z"),
        action: "approve",
        comments: "Meets initial criteria",
        duration: 2.5 // days
      }
    ],
    pendingApprovers: [ObjectId("...")],
    slaStatus: {
      dueDate: ISODate("2024-05-08T14:00:00Z"),
      isOverdue: false,
      escalated: false
    }
  },
  attachments: [
    {
      name: "budget_breakdown.xlsx",
      uploadId: "upload-123",
      uploadedAt: ISODate("2024-05-01T10:00:00Z")
    }
  ],
  audit: [
    {
      action: "submitted",
      userId: ObjectId("..."),
      timestamp: ISODate("2024-05-01T10:00:00Z"),
      details: { ip: "192.168.1.1" }
    },
    {
      action: "stage_completed",
      userId: ObjectId("..."),
      timestamp: ISODate("2024-05-03T14:00:00Z"),
      details: {
        stage: "initial-review",
        decision: "approve"
      }
    }
  ]
}
```

### Implementation Example

```javascript
class WorkflowEngine {
  async submitForApproval(submissionId) {
    const submission = await db.collection('submissions').findOne({ _id: submissionId });
    const workflow = await db.collection('workflows').findOne({ workflowId: submission.workflowId });
    
    // Initialize workflow state
    const firstStage = workflow.stages[0];
    const approvers = await this.getApprovers(firstStage, submission);
    
    await db.collection('submissions').updateOne(
      { _id: submissionId },
      {
        $set: {
          'workflowState.status': 'in_progress',
          'workflowState.currentStage': firstStage.stageId,
          'workflowState.currentStageStarted': new Date(),
          'workflowState.pendingApprovers': approvers,
          'workflowState.slaStatus': this.calculateSLA(firstStage)
        },
        $push: {
          audit: {
            action: 'submitted',
            userId: submission.submittedBy,
            timestamp: new Date()
          }
        }
      }
    );

    // Check auto-approval conditions
    await this.checkAutoApproval(submissionId, firstStage);
    
    // Send notifications
    await this.sendNotifications('onSubmit', submission, workflow);
  }

  async processApproval(submissionId, approverId, action, comments) {
    const submission = await db.collection('submissions').findOne({ _id: submissionId });
    const workflow = await db.collection('workflows').findOne({ workflowId: submission.workflowId });
    const currentStage = workflow.stages.find(s => s.stageId === submission.workflowState.currentStage);
    
    // Validate approver
    if (!submission.workflowState.pendingApprovers.includes(approverId)) {
      throw new Error('User not authorized to approve at this stage');
    }

    // Record approval
    const stageHistory = {
      stageId: currentStage.stageId,
      status: action,
      reviewedBy: approverId,
      reviewedAt: new Date(),
      action,
      comments,
      duration: this.calculateDuration(submission.workflowState.currentStageStarted)
    };

    // Update workflow state
    const updates = {
      $push: {
        'workflowState.history': stageHistory,
        audit: {
          action: 'stage_reviewed',
          userId: approverId,
          timestamp: new Date(),
          details: { stage: currentStage.stageId, decision: action }
        }
      }
    };

    if (action === 'approve') {
      const nextStage = this.getNextStage(workflow, currentStage);
      
      if (nextStage) {
        // Move to next stage
        const nextApprovers = await this.getApprovers(nextStage, submission);
        updates.$set = {
          'workflowState.currentStage': nextStage.stageId,
          'workflowState.currentStageStarted': new Date(),
          'workflowState.pendingApprovers': nextApprovers,
          'workflowState.slaStatus': this.calculateSLA(nextStage)
        };
      } else {
        // Workflow complete
        updates.$set = {
          'workflowState.status': 'approved',
          'workflowState.completedAt': new Date()
        };
      }
    } else if (action === 'reject') {
      updates.$set = {
        'workflowState.status': 'rejected',
        'workflowState.rejectedAt': new Date(),
        'workflowState.rejectionReason': comments
      };
    }

    await db.collection('submissions').updateOne({ _id: submissionId }, updates);
    
    // Send notifications
    await this.sendNotifications(
      action === 'approve' ? 'onApprove' : 'onReject',
      submission,
      workflow
    );
  }

  async checkAutoApproval(submissionId, stage) {
    if (!stage.autoApproveConditions) return;
    
    const submission = await db.collection('submissions').findOne({ _id: submissionId });
    
    const allConditionsMet = stage.autoApproveConditions.every(condition => {
      const fieldValue = this.getNestedValue(submission.data, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });

    if (allConditionsMet) {
      await this.processApproval(
        submissionId,
        'system',
        'approve',
        'Auto-approved based on predefined conditions'
      );
    }
  }

  async escalateOverdueTasks() {
    const overdueTasks = await db.collection('submissions').find({
      'workflowState.status': 'in_progress',
      'workflowState.slaStatus.dueDate': { $lt: new Date() },
      'workflowState.slaStatus.escalated': false
    }).toArray();

    for (const task of overdueTasks) {
      const workflow = await db.collection('workflows').findOne({ workflowId: task.workflowId });
      const currentStage = workflow.stages.find(s => s.stageId === task.workflowState.currentStage);
      
      if (currentStage.sla?.escalateTo) {
        // Add escalation approver
        await db.collection('submissions').updateOne(
          { _id: task._id },
          {
            $addToSet: {
              'workflowState.pendingApprovers': currentStage.sla.escalateTo
            },
            $set: {
              'workflowState.slaStatus.escalated': true,
              'workflowState.slaStatus.escalatedAt': new Date()
            },
            $push: {
              audit: {
                action: 'escalated',
                userId: 'system',
                timestamp: new Date(),
                details: {
                  escalatedTo: currentStage.sla.escalateTo,
                  reason: 'SLA breach'
                }
              }
            }
          }
        );

        // Send escalation notification
        await this.sendEscalationNotification(task, currentStage.sla.escalateTo);
      }
    }
  }
}
```

## 10. Form Analytics and Tracking

Track form performance, user behavior, and submission patterns.

### Schema Design

```javascript
// Form Analytics Collection
{
  _id: ObjectId("..."),
  formId: "customer-feedback",
  date: ISODate("2024-05-15"),
  metrics: {
    views: 1250,
    uniqueVisitors: 980,
    starts: 850,
    completions: 720,
    abandonment: 130,
    conversionRate: 0.847, // completions/starts
    averageCompletionTime: 485, // seconds
    medianCompletionTime: 420
  },
  fieldMetrics: [
    {
      fieldId: "email",
      interactions: 920,
      errors: 45,
      averageTimeSpent: 12.5, // seconds
      correctionRate: 0.049 // errors/interactions
    },
    {
      fieldId: "satisfaction",
      interactions: 850,
      averageTimeSpent: 8.2,
      valueDistribution: {
        "very_satisfied": 420,
        "satisfied": 280,
        "neutral": 100,
        "dissatisfied": 35,
        "very_dissatisfied": 15
      }
    }
  ],
  dropOffPoints: [
    {
      fieldId: "detailed_feedback",
      count: 65,
      percentage: 0.5 // 50% of abandonments
    },
    {
      fieldId: "contact_permission",
      count: 39,
      percentage: 0.3
    }
  ],
  deviceBreakdown: {
    desktop: 450,
    mobile: 220,
    tablet: 50
  },
  trafficSources: {
    direct: 300,
    email: 250,
    social: 120,
    search: 50
  }
}

// User Session Tracking Collection
{
  _id: ObjectId("..."),
  sessionId: "session-xyz123",
  formId: "customer-feedback",
  userId: ObjectId("..."), // null for anonymous
  startedAt: ISODate("2024-05-15T14:30:00Z"),
  completedAt: ISODate("2024-05-15T14:38:05Z"),
  duration: 485, // seconds
  device: {
    type: "desktop",
    browser: "Chrome",
    os: "Windows 10",
    screenResolution: "1920x1080"
  },
  interactions: [
    {
      fieldId: "email",
      action: "focus",
      timestamp: ISODate("2024-05-15T14:30:15Z")
    },
    {
      fieldId: "email",
      action: "blur",
      timestamp: ISODate("2024-05-15T14:30:28Z"),
      value: "user@example" // Invalid
    },
    {
      fieldId: "email",
      action: "error",
      timestamp: ISODate("2024-05-15T14:30:29Z"),
      error: "Invalid email format"
    },
    {
      fieldId: "email",
      action: "correction",
      timestamp: ISODate("2024-05-15T14:30:45Z"),
      value: "user@example.com"
    }
  ],
  fieldTimes: {
    "email": 30,
    "name": 15,
    "satisfaction": 8,
    "detailed_feedback": 120,
    "contact_permission": 5
  },
  completed: true,
  abandonmentPoint: null,
  source: {
    referrer: "https://company.com/support",
    campaign: "feedback-may-2024",
    medium: "email"
  }
}

// A/B Test Results Collection
{
  _id: ObjectId("..."),
  testId: "form-layout-test",
  formId: "signup-form",
  startDate: ISODate("2024-05-01"),
  endDate: ISODate("2024-05-15"),
  status: "completed",
  variants: [
    {
      variantId: "control",
      name: "Single Page",
      description: "All fields on one page",
      traffic: 0.5,
      metrics: {
        views: 5000,
        starts: 4200,
        completions: 3150,
        conversionRate: 0.75,
        averageTime: 180
      }
    },
    {
      variantId: "variant-a",
      name: "Multi-step",
      description: "3-step wizard",
      traffic: 0.5,
      metrics: {
        views: 5100,
        starts: 4400,
        completions: 3740,
        conversionRate: 0.85,
        averageTime: 240
      }
    }
  ],
  winner: "variant-a",
  confidence: 0.95,
  uplift: 0.133 // 13.3% improvement
}
```

### Implementation Example

```javascript
class FormAnalyticsService {
  async trackFormView(formId, sessionData) {
    const sessionId = generateSessionId();
    
    // Create session
    await db.collection('formSessions').insertOne({
      sessionId,
      formId,
      userId: sessionData.userId,
      startedAt: new Date(),
      device: this.parseDevice(sessionData.userAgent),
      interactions: [],
      source: this.parseSource(sessionData.referrer),
      completed: false
    });

    // Update daily metrics
    await this.updateDailyMetrics(formId, 'views');
    
    return sessionId;
  }

  async trackFieldInteraction(sessionId, interaction) {
    await db.collection('formSessions').updateOne(
      { sessionId },
      {
        $push: {
          interactions: {
            ...interaction,
            timestamp: new Date()
          }
        },
        $inc: {
          [`fieldTimes.${interaction.fieldId}`]: interaction.duration || 0
        }
      }
    );

    // Track errors
    if (interaction.action === 'error') {
      await this.updateFieldMetrics(
        interaction.formId,
        interaction.fieldId,
        'errors'
      );
    }
  }

  async completeForm(sessionId, submissionData) {
    const session = await db.collection('formSessions').findOne({ sessionId });
    
    await db.collection('formSessions').updateOne(
      { sessionId },
      {
        $set: {
          completedAt: new Date(),
          duration: Math.floor((new Date() - session.startedAt) / 1000),
          completed: true
        }
      }
    );

    // Update completion metrics
    await this.updateDailyMetrics(session.formId, 'completions');
    await this.updateCompletionTime(session.formId, session.duration);
  }

  async trackAbandonment(sessionId, lastFieldId) {
    await db.collection('formSessions').updateOne(
      { sessionId },
      {
        $set: {
          abandonedAt: new Date(),
          abandonmentPoint: lastFieldId,
          completed: false
        }
      }
    );

    const session = await db.collection('formSessions').findOne({ sessionId });
    
    // Update abandonment metrics
    await this.updateDailyMetrics(session.formId, 'abandonment');
    await this.updateDropOffPoint(session.formId, lastFieldId);
  }

  async generateFormReport(formId, dateRange) {
    const pipeline = [
      {
        $match: {
          formId,
          startedAt: {
            $gte: dateRange.start,
            $lte: dateRange.end
          }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          completedSessions: {
            $sum: { $cond: ['$completed', 1, 0] }
          },
          abandonedSessions: {
            $sum: { $cond: ['$abandonmentPoint', 1, 0] }
          },
          avgDuration: {
            $avg: '$duration'
          },
          devices: {
            $push: '$device.type'
          },
          dropOffPoints: {
            $push: '$abandonmentPoint'
          }
        }
      }
    ];

    const results = await db.collection('formSessions').aggregate(pipeline).toArray();
    
    // Generate insights
    const insights = this.generateInsights(results[0]);
    
    return {
      summary: results[0],
      insights,
      recommendations: this.generateRecommendations(results[0])
    };
  }

  async runABTest(formId, variants, duration) {
    const testId = generateTestId();
    
    // Create test
    const test = {
      testId,
      formId,
      startDate: new Date(),
      endDate: new Date(Date.now() + duration),
      status: 'running',
      variants: variants.map(v => ({
        ...v,
        metrics: {
          views: 0,
          starts: 0,
          completions: 0
        }
      }))
    };

    await db.collection('abTests').insertOne(test);
    
    // Set up variant assignment
    await this.setupVariantAssignment(testId, variants);
    
    return testId;
  }

  generateInsights(data) {
    const insights = [];
    
    // Conversion rate insight
    const conversionRate = data.completedSessions / data.totalSessions;
    if (conversionRate < 0.7) {
      insights.push({
        type: 'warning',
        message: `Low conversion rate: ${(conversionRate * 100).toFixed(1)}%`,
        recommendation: 'Consider simplifying the form or reducing required fields'
      });
    }

    // Device usage insight
    const deviceCounts = this.countByValue(data.devices);
    const mobilePercentage = deviceCounts.mobile / data.totalSessions;
    if (mobilePercentage > 0.5) {
      insights.push({
        type: 'info',
        message: `${(mobilePercentage * 100).toFixed(1)}% of users are on mobile`,
        recommendation: 'Ensure mobile optimization is prioritized'
      });
    }

    // Drop-off analysis
    const dropOffCounts = this.countByValue(data.dropOffPoints);
    const topDropOff = Object.entries(dropOffCounts)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topDropOff) {
      insights.push({
        type: 'critical',
        message: `${topDropOff[0]} causes ${topDropOff[1]} abandonments`,
        recommendation: 'Review this field for clarity and necessity'
      });
    }

    return insights;
  }
}
```

## Best Practices Summary

### 1. Schema Design
- Use flexible schemas that can accommodate changing requirements
- Separate form definitions from submissions
- Include version information for migrations
- Store metadata for tracking and analytics

### 2. Performance
- Index frequently queried fields (formId, userId, status)
- Use aggregation pipelines for complex analytics
- Implement pagination for large result sets
- Consider archiving old submissions

### 3. Security
- Validate all inputs on the server side
- Implement proper authentication and authorization
- Encrypt sensitive data
- Use secure tokens for resume links and invitations

### 4. User Experience
- Implement auto-save for long forms
- Provide clear progress indicators
- Allow users to save and resume later
- Send confirmation emails with submission details

### 5. Data Integrity
- Use transactions for multi-document updates
- Implement idempotent operations
- Maintain audit trails
- Handle concurrent edits gracefully

### 6. Scalability
- Design for horizontal scaling
- Use caching for frequently accessed data
- Implement rate limiting
- Consider using message queues for async operations

These patterns provide a comprehensive foundation for building robust form and registration systems with MongoDB. Each pattern can be adapted and combined based on specific requirements.