/**
 * Admission Validation Service
 * Prevents inappropriate bed assignments (e.g., senior patients in pediatric wards)
 */

class AdmissionValidator {
  /**
   * Validate if patient can be assigned to specific ward
   */
  static validateWardAssignment(patient, ward) {
    const warnings = [];
    let isAppropriate = true;

    // Age-based validation
    if (ward.age_validation_required) {
      if (patient.age < ward.min_age) {
        warnings.push(`Patient age ${patient.age} is below minimum age ${ward.min_age} for ${ward.name}`);
        isAppropriate = false;
      }
      
      if (patient.age > ward.max_age) {
        warnings.push(`Patient age ${patient.age} exceeds maximum age ${ward.max_age} for ${ward.name}`);
        isAppropriate = false;
      }
    }

    // Gender-based validation
    if (ward.gender_restriction !== 'Any' && ward.gender_restriction !== patient.gender) {
      warnings.push(`${ward.name} is restricted to ${ward.gender_restriction} patients only`);
      isAppropriate = false;
    }

    // Special ward type validations
    if (ward.type === 'Daycare' && patient.age > 12) {
      warnings.push('Daycare ward is for patients 12 years and below');
      isAppropriate = false;
    }

    if (ward.type === 'ICU' && patient.age < 18) {
      warnings.push('ICU admission requires adult patient (18+ years)');
      isAppropriate = false;
    }

    // Pediatric-specific validations
    if (ward.name.toLowerCase().includes('pediatric') && patient.age > 12) {
      warnings.push('Pediatric ward is for children 12 years and below');
      isAppropriate = false;
    }

    return {
      isAppropriate,
      warnings,
      riskLevel: this.calculateRiskLevel(patient, ward, warnings)
    };
  }

  /**
   * Calculate risk level for admission
   */
  static calculateRiskLevel(patient, ward, warnings) {
    if (warnings.length > 0) return 'HIGH';
    
    if (patient.age > 65 && ward.type !== 'ICU') return 'MEDIUM';
    if (patient.age < 5 && ward.type !== 'Daycare') return 'MEDIUM';
    
    return 'LOW';
  }

  /**
   * Get recommended wards for patient
   */
  static getRecommendedWards(patient, allWards) {
    return allWards
      .filter(ward => {
        // Basic age filter
        if (ward.age_validation_required) {
          if (patient.age < ward.min_age || patient.age > ward.max_age) {
            return false;
          }
        }
        
        // Gender filter
        if (ward.gender_restriction !== 'Any' && ward.gender_restriction !== patient.gender) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // Priority order: ICU > Special Care > Regular > Emergency > Daycare
        const priority = { 'ICU': 4, 'Special Care': 3, 'Regular Care': 2, 'Emergency': 1, 'Daycare': 0 };
        return (priority[b.type] || 0) - (priority[a.type] || 0);
      });
  }

  /**
   * Check for senior patient in pediatric ward (main issue you asked about)
   */
  static checkSeniorInPediatricWard(patient, ward) {
    const isSenior = patient.age >= 65;
    const isPediatricWard = ward.name.toLowerCase().includes('pediatric') || ward.type === 'Daycare';
    
    if (isSenior && isPediatricWard) {
      return {
        violation: true,
        message: `Senior patient (${patient.age} years) cannot be admitted to pediatric ward (${ward.name})`,
        suggestion: 'Consider Regular Medical Ward or Special Care Wing instead'
      };
    }
    
    return { violation: false };
  }
}

module.exports = AdmissionValidator;
