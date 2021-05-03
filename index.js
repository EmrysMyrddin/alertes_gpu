import puppeteer from "puppeteer"
import * as mailjet from './mailjet.js'

const SCRAP_INTERVAL = parseInt(process.env.SCRAP_INTERVAL) || 60
const CHROME_HEADLESS = process.env.CHROME_HEADLESS !== 'false';

const chromeOptions = {
    headless: CHROME_HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
};

['SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2'].forEach(signal => process.on(signal, () => process.exit(0)))
main().catch(err => console.error('Fatal error:', err))

async function main() {
    console.info(`Scraping every ${SCRAP_INTERVAL}s (headless: ${CHROME_HEADLESS})`)
    while(true) {
        console.time('scrapping time')
        console.info('\nscrapping started')
        const browser = await puppeteer.launch(chromeOptions)
        await scrapAll(browser).finally(() => browser.close())
        console.timeEnd('scrapping time')
        await waitFor(SCRAP_INTERVAL)
    }
}

async function scrapAll(browser) {
    const scrap = await makeScrapper(browser)
    const results = await Promise.all([scrap('LDLC', ldlc), scrap('TOP ACHAT', topAchat), scrap('MATERIEL.NET', materielNet)])
    const availableCards = results.flat()

    console.info('products found:', availableCards)

    if (availableCards.length === 0) return

    await mailjet.send(availableCards)
}

// SCRAPPERS

const {LDLC_URL, TOP_ACHAT_URL, MATERIEL_NET_URL} = process.env

/** @param {puppeteer.Page} page */
async function ldlc(page) {
    if(!LDLC_URL) return []
    await page.goto(LDLC_URL)

    return getProducts(page, 'https://www.ldlc.com', {
        outOfStock: 'Aucun produit ne correspond à vos critères.',
        product: '.listing-product .pdt-item',
        link: '.pdt-desc a',
        price: '.price'
    })
}

/** @param {puppeteer.Page} page */
async function topAchat(page) {
    if(!TOP_ACHAT_URL) return []
    await page.goto(TOP_ACHAT_URL)

    return getProducts(page, 'https://www.topachat.com', {
        outOfStock: 'Il n’y a aucun article correspondant aux valeurs de filtres que vous avez choisies.',
        product: '.produits.list .grille-produit',
        link: '.libelle a:not(.avis)',
        name: '.libelle a:not(.avis) h3',
        price: '.price',
    })
}

/** @param {puppeteer.Page} page */
async function materielNet(page) {
    if(!MATERIEL_NET_URL) return []
    await page.goto(MATERIEL_NET_URL)

    return getProducts(page, 'https://www.materiel.net', {
        outOfStock: 'Aucun article ne correspond',
        product: 'ul.c-products-list .c-products-list__item',
        link: '.c-product__meta a.c-product__link',
        price: '.o-product__prices'
    })
}


// HELPERS
/** @param {puppeteer.Browser} browser */
async function makeScrapper(browser) {
    return async function scrap(name, scrappingFunction) {
        console.time(`[${name}] scrapping time`)
        const page = await browser.newPage()
        page.name = name
        page.on('console', (msg) => console.log(`[${name}] PAGE LOG:`, msg.text()))

        try {
            const results = await scrappingFunction(page)
            console.timeEnd(`[${name}] scrapping time`)
            return results
        } finally {
            await page.close()
        }
    }
}


/**
 * @param {puppeteer.Page} page
 * @param {string} linkPrefix
 * @param {ProductSelector} selector
 * @returns {Promise<puppeteer.WrapElementHandle<Result[]>>}
 */
async function getProducts(page, linkPrefix, selector) {
    if(await contains(page, selector.outOfStock)) return []
    const results = await page.$$eval(selector.product, getProductsInfo, linkPrefix, selector)
    if (results.length === 0) console.error(`[${page.name}]`, 'Products list should not be empty if stock detected !')
    else console.info(`[${page.name}] found ${results.length} products`)
    return results
}

/**
 * @param {puppeteer.Page} page
 * @param {string | Regexp} text
 * @returns {Promise<boolean>}
 * */
async function contains(page, text) {
    const content = await page.content()
    return Boolean(content.match(text))
}

/**
 * @param {Array<Element>} elements
 * @param {ProductSelector} selector
 * @param {string} linkPrefix
 * @returns {Array<Result>}
 */
async function getProductsInfo(elements, linkPrefix, selector) {
    return elements.map(element => ({
        name: element.querySelector(selector.name ?? selector.link)?.textContent.trim() ?? '',
        link: `${linkPrefix}${element.querySelector(selector.link)?.getAttribute('href') ?? ''}`,
        price: element.querySelector(selector.price)?.textContent.trim() ?? ''
    }))
}

/** @param {number} delay */
function waitFor(delay) {
    return new Promise(resolve => {
        setTimeout(resolve, delay * 1000)
    })
}

/**
 * @typedef {Object} Result
 * @property {string} name
 * @property {string} link
 */

/**
 * @typedef {Object} ProductSelector
 * @property {string} product
 * @property {string} link
 * @property {string} name
 * @property {string} price
 * @property {string} outOfStock
 */
