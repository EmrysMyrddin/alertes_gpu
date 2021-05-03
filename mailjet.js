import mailjet from 'node-mailjet'

const address = {
    "Email": "v.cocaud+mailjet@gmail.com",
    "Name": "Valentin"
}

export async function send(products) {
    const client = mailjet.connect(process.env.MAILJET_API_KEY, process.env.MAILJET_API_SECRET)

    const message = `
        <h3>Cartes graphique en stock</h3>
        <ul>
            ${products.map(product => `<li><a href="${product.link}">${product.name} (<strong>${product.price})</strong></a></li>`)}
        </ul>
    `

    const request = await client
        .post("send", {'version': 'v3.1'})
        .request({
            "Messages":[
                {
                    "From": address,
                    "To": [address],
                    "Subject": "Graphic card available !",
                    "TextPart": "",
                    "HTMLPart": message,
                }
            ]
        })

    console.info('Email sent:', request.body)
}
