// Validators Utility
module.exports = {
  isPhoneNumber: (phone) => /^\d{10,13}$/.test(phone),
  isEmail: (email) => /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email),
  isCPF: (cpf) => /^\d{11}$/.test(cpf),
  isUUID: (id) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)
};
