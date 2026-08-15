/**
 * Efecto NETO de una producción sobre el stock del producto de salida (§154).
 *
 * Existe porque hay producciones donde el producto final es también uno de
 * sus propios ingredientes. El caso real: el yogurt se produce con yogurt
 * (como cultivo iniciador) más leche, para rendirlo. Lo mismo pasa con masas
 * madre, fondos de cocina y encurtidos.
 *
 * El módulo de Producción Manual escondía el producto de salida de la lista
 * de ingredientes, así que esa producción era imposible de cargar ahí. Por
 * receta sí funcionaba — de ahí que a una persona "le dejara" y a otra no.
 *
 * Al permitirlo hay que mostrar el neto, porque es lo único que hace evidente
 * un error de tipeo: producir 10 kg consumiendo 2 kg deja +8 netos, pero
 * producir 10 consumiendo 0.2 por un decimal mal puesto deja +9.8 y nadie lo
 * nota hasta el conteo.
 */

export interface ProductionNetInput {
    /** Item que se produce. */
    outputItemId: string;
    /** Cantidad producida. */
    outputQuantity: number;
    /** Ingredientes que se consumen. */
    ingredients: { itemId: string; quantity: number }[];
}

export interface ProductionNet {
    /** true si el producto de salida aparece entre sus propios ingredientes. */
    selfConsuming: boolean;
    /** Cantidad del producto de salida consumida como ingrediente. */
    consumedFromOutput: number;
    /** Variación real del stock del producto de salida (producido − consumido). */
    net: number;
}

export function computeProductionNet(input: ProductionNetInput): ProductionNet {
    const produced = Number.isFinite(input.outputQuantity) ? input.outputQuantity : 0;

    const consumedFromOutput = input.ingredients
        .filter(i => i.itemId === input.outputItemId)
        .reduce((sum, i) => sum + (Number.isFinite(i.quantity) ? i.quantity : 0), 0);

    return {
        selfConsuming: consumedFromOutput > 0,
        consumedFromOutput,
        net: produced - consumedFromOutput,
    };
}

/**
 * Aviso para la pantalla cuando la producción se consume a sí misma.
 * null cuando no aplica.
 *
 * No bloquea: consumir más de lo que se produce es raro pero legítimo (una
 * merma registrada como producción negativa), y quien carga tiene que poder
 * hacerlo viendo el número, no peleando con un candado.
 */
export function productionNetWarning(
    net: ProductionNet,
    itemName: string,
    unit: string,
): string | null {
    if (!net.selfConsuming) return null;
    const producido = trim(net.consumedFromOutput + net.net);
    const consumido = trim(net.consumedFromOutput);
    const neto = trim(net.net);
    const signo = net.net > 0 ? '+' : '';
    return `${itemName} es también ingrediente: se producen ${producido} ${unit} y se consumen `
        + `${consumido} ${unit} → el stock varía ${signo}${neto} ${unit}.`;
}

function trim(n: number): string {
    return (Math.round(n * 1000) / 1000).toString();
}
