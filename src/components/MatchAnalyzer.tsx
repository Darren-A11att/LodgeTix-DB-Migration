import React from 'react';

interface MatchDetails {
  payment: any;
  registration: any;
  matchedFields: Array<{
    paymentField: string;
    paymentValue: any;
    registrationField: string;
    registrationValue: any;
    matchType: 'exact' | 'partial' | 'fuzzy';
  }>;
  matchMethod: string;
  confidence: number;
}

interface MatchAnalyzerProps {
  payment: any;
  registration: any | null;
  onSaveMatch?: (matchDetails: MatchDetails) => void;
}

export default function MatchAnalyzer({ payment, registration, onSaveMatch }: MatchAnalyzerProps) {
  const analyzeMatch = (): MatchDetails => {
    const matchedFields: MatchDetails['matchedFields'] = [];
    let matchMethod = 'none';
    let confidence = 0;

    if (!registration) {
      return { payment, registration, matchedFields, matchMethod, confidence };
    }

    // Check Payment ID matches
    const paymentIds = [
      payment.paymentId,
      payment.transactionId,
      payment.originalData?.['PaymentIntent ID'],
      payment.originalData?.id
    ].filter(Boolean);

    const registrationPaymentIds = [
      registration.stripePaymentIntentId,
      registration.squarePaymentId,
      registration.registrationData?.stripePaymentIntentId,
      registration.registrationData?.stripe_payment_intent_id,
      registration.registrationData?.square_payment_id
    ].filter(Boolean);

    // Check for payment ID matches
    for (const pId of paymentIds) {
      for (const rId of registrationPaymentIds) {
        if (pId === rId) {
          matchedFields.push({
            paymentField: findFieldPath(payment, pId),
            paymentValue: pId,
            registrationField: findFieldPath(registration, rId),
            registrationValue: rId,
            matchType: 'exact'
          });
          matchMethod = 'payment_id';
          confidence = Math.max(confidence, 85);
        }
      }
    }

    // Check confirmation number matches
    const paymentConfirmation = payment.originalData?.metadata?.confirmationNumber || 
                                payment.originalData?.metadata?.confirmation_number;
    const registrationConfirmation = registration.confirmationNumber;

    if (paymentConfirmation && registrationConfirmation && paymentConfirmation === registrationConfirmation) {
      matchedFields.push({
        paymentField: 'originalData.metadata.confirmationNumber',
        paymentValue: paymentConfirmation,
        registrationField: 'confirmationNumber',
        registrationValue: registrationConfirmation,
        matchType: 'exact'
      });
      if (matchMethod === 'none') {
        matchMethod = 'confirmation_number';
        confidence = 80;
      }
    }

    // Check email matches
    if (payment.customerEmail && registration.customerEmail && 
        payment.customerEmail.toLowerCase() === registration.customerEmail.toLowerCase()) {
      matchedFields.push({
        paymentField: 'customerEmail',
        paymentValue: payment.customerEmail,
        registrationField: 'customerEmail',
        registrationValue: registration.customerEmail,
        matchType: 'exact'
      });
      if (matchMethod === 'none') {
        matchMethod = 'email';
        confidence = 50;
      }
    }

    // Check amount matches
    const paymentAmount = payment.amount || payment.grossAmount;
    const registrationAmount = registration.totalAmountPaid?.$numberDecimal || 
                              registration.totalAmount?.$numberDecimal ||
                              registration.totalAmountPaid ||
                              registration.totalAmount;

    if (paymentAmount && registrationAmount) {
      const amountDiff = Math.abs(parseFloat(paymentAmount) - parseFloat(registrationAmount));
      if (amountDiff < 0.01) {
        matchedFields.push({
          paymentField: 'amount',
          paymentValue: paymentAmount,
          registrationField: findAmountField(registration),
          registrationValue: registrationAmount,
          matchType: 'exact'
        });
      } else if (amountDiff < 1.0) {
        matchedFields.push({
          paymentField: 'amount',
          paymentValue: paymentAmount,
          registrationField: findAmountField(registration),
          registrationValue: registrationAmount,
          matchType: 'fuzzy'
        });
      }
    }

    return { payment, registration, matchedFields, matchMethod, confidence };
  };

  const findFieldPath = (obj: any, value: any, path: string = ''): string => {
    for (const key in obj) {
      const currentPath = path ? `${path}.${key}` : key;
      if (obj[key] === value) {
        return currentPath;
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const result = findFieldPath(obj[key], value, currentPath);
        if (result) return result;
      }
    }
    return '';
  };

  const findAmountField = (registration: any): string => {
    if (registration.totalAmountPaid?.$numberDecimal) return 'totalAmountPaid.$numberDecimal';
    if (registration.totalAmount?.$numberDecimal) return 'totalAmount.$numberDecimal';
    if (registration.totalAmountPaid) return 'totalAmountPaid';
    if (registration.totalAmount) return 'totalAmount';
    return 'amount';
  };

  const matchDetails = analyzeMatch();

  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-gray-700">Match Analysis</h4>
        {registration && onSaveMatch && (
          <button
            onClick={() => onSaveMatch(matchDetails)}
            className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Save Match Pattern
          </button>
        )}
      </div>
      
      {matchDetails.matchedFields.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Match Method:</span> {matchDetails.matchMethod}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Confidence:</span> {matchDetails.confidence}%
          </div>
          <div className="mt-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Matched Fields:</div>
            {matchDetails.matchedFields.map((field, index) => (
              <div key={index} className="bg-white p-2 rounded border border-gray-200 mb-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium text-gray-600">Payment:</span>
                    <div className="text-gray-800">{field.paymentField}</div>
                    <div className="text-gray-600 truncate">{String(field.paymentValue)}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Registration:</span>
                    <div className="text-gray-800">{field.registrationField}</div>
                    <div className="text-gray-600 truncate">{String(field.registrationValue)}</div>
                  </div>
                </div>
                <div className={`mt-1 text-xs ${
                  field.matchType === 'exact' ? 'text-green-600' : 
                  field.matchType === 'fuzzy' ? 'text-yellow-600' : 
                  'text-gray-600'
                }`}>
                  {field.matchType} match
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          {registration ? 'No matching fields found' : 'No registration to analyze'}
        </div>
      )}
      
      {registration && matchDetails.matchedFields.length === 0 && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          This appears to be a manual match with no automatic field matches. 
          Saving this match will help improve future matching algorithms.
        </div>
      )}
    </div>
  );
}