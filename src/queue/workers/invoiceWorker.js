// Invoice Worker
module.exports = (queue) => {
  queue.process(async (job) => {
    // Exemplo: gerar nota fiscal
    const { orderId, amount } = job.data;
    // Aqui pode integrar com serviço externo de NF
    return { status: 'invoice generated', orderId, amount };
  });
};
