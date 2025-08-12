// Delivery Worker
module.exports = (queue) => {
  queue.process(async (job) => {
    // Exemplo: notificar entrega
    const { deliveryId, address } = job.data;
    // Aqui pode integrar com serviço de SMS/email
    return { status: 'delivery notified', deliveryId, address };
  });
};
