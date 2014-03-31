function FieldError(field, message) {
    this.name = 'Field error';
    this.message = message;
    this.field = field;
    this.stack = (new Error()).stack;
}
FieldError.prototype = new Error;

exports.FieldError = FieldError;