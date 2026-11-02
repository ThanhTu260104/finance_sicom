import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidContractTypes } from '../contract-type.util';

@ValidatorConstraint({ name: 'isContractTypes', async: false })
export class IsContractTypesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isValidContractTypes(value);
  }

  defaultMessage() {
    return 'contractType must be MAINTENANCE, OPERATION, REPAIR, or PROJECT (multiple values separated by ";")';
  }
}

export function IsContractTypes(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsContractTypesConstraint,
    });
  };
}
