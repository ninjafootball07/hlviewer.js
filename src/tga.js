import Path from 'path'
import Reader, {TYPE_UB} from './reader.js'
import xhr from './xhr.js'

export default class Tga {
    constructor(name, width, height, data) {
        this.name = name
        this.width = width
        this.height = height
        this.data = data
    }

    static parseFromArrayBuffer(buffer, url) {
        let r = new Reader(buffer)
        
        let header = {
            idLength:     r.ub(),
            colorMapType: r.ub(),
            imageType:    r.ub(),
            colorMap: {
                firstEntryIndex: r.us(),
                length:          r.us(),
                size:            r.ub()
            },
            image: {
                xOrigin:    r.us(),
                yOrigin:    r.us(),
                width:      r.us(),
                height:     r.us(),
                depth:      r.ub(),
                descriptor: r.ub()
            }
        }

        let imageId
        if (header.idLength) {
            imageId = r.arrx(header.idLength, TYPE_UB)
        }

        let colorMapData
        if (header.colorMapType) {
            throw new Error('Not implemented')
            colorMapData = r.arrx(header.colorMap.length, TYPE_UB)
        }

        let pixelCount = header.image.width * header.image.height
        let imageData

        if (header.imageType === 0x02) {
            imageData = r.arrx(pixelCount *  header.image.depth / 8, TYPE_UB)
            if (header.image.depth === 24) {
                let temp = new Uint8Array(pixelCount * 4)
                for (let i = 0; i < imageData.length; ++i) {
                    temp[i * 4    ] = imageData[i * 3 + 2]
                    temp[i * 4 + 1] = imageData[i * 3 + 1]
                    temp[i * 4 + 2] = imageData[i * 3]
                    temp[i * 4 + 3] = 255
                }
                imageData = temp
            } else if (header.image.depth === 32) {
                let temp = new Uint8Array(pixelCount * 4)
                for (let i = 0; i < imageData.length; ++i) {
                    temp[i * 4    ] = imageData[i * 4 + 2]
                    temp[i * 4 + 1] = imageData[i * 4 + 1]
                    temp[i * 4 + 2] = imageData[i * 4]
                    temp[i * 4 + 3] = 255
                }
                imageData = temp
            }
        } else if (header.imageType === 0x0A) {
            imageData = new Uint8Array(pixelCount * 4)
            if (header.image.depth === 24) {
                for (let i = 0; i < imageData.length; /* no ++i */) {
                    let repCount = r.ub()
                    if (repCount & 0x80) {
                        repCount = (repCount & 0x7f) + 1
                        let bl = r.ub()
                        let gr = r.ub()
                        let rd = r.ub()
                        while (i < imageData.length && repCount) {
                            imageData[i    ] = rd
                            imageData[i + 1] = gr
                            imageData[i + 2] = bl
                            imageData[i + 3] = 255
                            i += 4
                            --repCount
                        }
                    } else {
                        repCount = (repCount & 0x7f) + 1
                        while (i < imageData.length && repCount) {
                            imageData[i + 2] = r.ub()
                            imageData[i + 1] = r.ub()
                            imageData[i    ] = r.ub()
                            imageData[i + 3] = 255
                            i += 4
                            --repCount
                        }
                    }
                }
            }
        }

        let name = Path.basename(url, '.tga')
        return new Tga(name, header.image.width, header.image.height, imageData)
    }

    static loadFromUrl(url, progressCallback = null) {
        return xhr(url, {
                isBinary: true,
                progressCallback
            })
            .then(response => Tga.parseFromArrayBuffer(response, url))
    }
}