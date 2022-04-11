const parse = require('node-html-parser').parse
const axios = require('axios').default;
const { writeToPath } = require('@fast-csv/format');

go();

async function go(){
    let internetArchiveItems = await fetchInternetArchiveItemNames();
    let allMetadata = {}
    for (let item of internetArchiveItems){
        allMetadata[item] = {}
    }
    allMetadata = generateInducksUrls(allMetadata);
    allMetadata = await fetchMetadataFromInducks(allMetadata);
    let finalMetadataForCsv = formatDataForCSV(allMetadata);
    outputCSV(finalMetadataForCsv);
}

function formatDataForCSV(allMetadata){
   let finalMetadataArray = []
    for (let property in allMetadata) {
        let finalMetadata = {};
        finalMetadata.identifier = property;
        let iaMetadata = allMetadata[property].iaMetadata;
        for (let pieceOfMetadata in iaMetadata) {
            finalMetadata[pieceOfMetadata] = iaMetadata[pieceOfMetadata];
        }
        finalMetadataArray.push(finalMetadata);
    }
    return finalMetadataArray;
}

function outputCSV(finalMetadata){
    const path = `${__dirname}/metadata.csv`;
    const options = { headers: true, quoteColumns: true };
    // const data = [{ name: 'Stevie', id: 10 }, { name: 'Ray', id: 20 }];
    //console.log(finalMetadata);
    writeToPath(path, finalMetadata, options)
        .on('error', err => console.error(err))
        .on('finish', () => console.log('Done writing.'));
}

async function fetchMetadataFromInducks(allMetadata){
    console.log(allMetadata);
    for (let property in allMetadata) {
        let url = allMetadata[property].inducksUrl;
        let response = await axios.get(url);
        let iaMetadata = parseInducksForMetadata(response.data,url);
        allMetadata[property].iaMetadata = iaMetadata
    }
    return allMetadata;
}

function generateInducksUrls(metadata){
    for (let property in metadata) {
        let item = property;
        let year = item.split("mickey_friends_")[1].split("-")[0]
        let issue = item.split("_")[3];
        metadata[property].inducksUrl = `https://inducks.org/issue.php?c=uk%2FMF${year}-${issue}`;
    }
    return metadata;
}

async function fetchInternetArchiveItemNames(){
    let response = await axios.get('https://archive.org/search.php?query=creator%3A%22Fleetway+Editions%22');
    // when this gets to more than one page we'll need to refactor to loop through the pages.
    let doc = parse(response.data);
    let itemElements = doc.querySelectorAll(".item-ia .item-ttl a[href*=details]");
    let identifiers = itemElements.map((el) => {
        return el._attrs.href.split("/details/")[1];
    })
    return identifiers;
}

function parseInducksForMetadata(response,url){
    let doc = parse(response);
    let creators = getListOfCreators(doc);
    let appearances = getListOfAppearances(doc);
    let storyDetails = getStoryDetails(doc);
    let outputHtml = produceHtml(creators,appearances,storyDetails,url);
    let iaMetadata = generateMetadata(creators,appearances,outputHtml);
    return iaMetadata;
}

function generateMetadata(creators,appearances,outputHtml){
    let finalMetadata = {}
    if (creators){
        let creatorsMetadata = "";
        for (let item of creators){
            creatorsMetadata += `${item},`
        }
        finalMetadata["mickey_and_friends_creator"] = creatorsMetadata;
    }
    if (appearances){
        let appearanceMetadata = "";
        for (let item of appearances){
            appearanceMetadata += `${item},`
        }
        finalMetadata["mickey_and_friends_character"] = appearanceMetadata;
    }
    finalMetadata.description = outputHtml;
    return finalMetadata;
}

function produceHtml(creators,appearances,storyDetails,url){
    let creatorsHtml = generateCreatorsHtml(creators);
    let appearancesHtml = generateAppearancesHtml(appearances);
    let storyDetailsHtml = generateStoryDetailsHtml(storyDetails)
    let html = `<p>
Mickey and friends was a weekly comic book published in the UK between 1993 and 1996.
<br><br>
It included short comics featuring Mickey Mouse, Goofy, Donald Duck, and other popular Disney characters. Stories frequently spanned multiple issues with a "to be continued" tagline. It also featured a letters page, joke pages, quizzes, puzzles, etc, and was aimed at younger readers. The comic was published weekly by Fleetway Editions Ltd., 25/31 Tavistock Place, London, WC1H 9SU.
<br><br>
</p>
<div classname="mickey_and_friends_description">
<h3>Comic Details:</h3>
${storyDetailsHtml}
${creatorsHtml}
${appearancesHtml}
<br><br>
<p>
The data presented here is based on <a href=${url}>information from the freely available Inducks database</a>.
</p>
<hr>
<p>
<br><br>
Scanned at 600dpi to .tif and zipped to .cbz format, using Vuescan + a Canon LiDE 20. Some colour correction was applied to make the scanned image look as much as possible like the physical pages. Images were cropped to A4, but the comics have wide margins so you don't miss much. These comics have been my collection since childhood, so there are dogs ears and pieces missing from issues, including entire front covers in some cases. If I forgot to put a weight on the scanner lid there may be some instances of blurring on some pages. 
</p>
</div>
`;
    return html;
    function generateStoryDetailsHtml(storyDetails){
        let finalHtml = `<p>
<b>Contents: </b>
<br>
<ul>
`
        for (let item of storyDetails){
            finalHtml += `<li>${item.title}`;
            if (item.hero){
                finalHtml += ` (${item.hero})`;
            }
            if (item.description){
                finalHtml += ` - ${item.description}`
            }
            finalHtml += `</li>`
        }
        finalHtml += `</ul></p>`
        return finalHtml;
    }
    function generateCreatorsHtml(creators){
        let finalHtml = `<br><br><p>
<b>Creators: </b>
<br>
<ul>`
        for (let item of creators){
                finalHtml += `<li><a href="https://archive.org/search.php?query=mickey_and_friends_creator%3A(${item})">${item}</a></li>`
        }
        finalHtml += `</ul></p>`;
        return finalHtml;
    }
    function generateAppearancesHtml(appearances){
        let finalHtml = `<br><br><p>
<b>Characters: </b>
<br>
<ul>`
        for (let item of appearances){
                finalHtml += `<li><a href="https://archive.org/search.php?query=mickey_and_friends_character%3A(${item})">${item}</a></li>`
        }
        finalHtml += `</ul></p>`;
        return finalHtml;
    }

}

function getStoryDetails(doc){
    let titleElements = doc.querySelectorAll(".content .title:not(:empty)");
    let stories = titleElements.map((el) => {
        let storyObj = {}
        let title = el.innerText;
        storyObj.title = title;
        let hero = el.closest(".name").querySelector(".hero");
        if (hero){
            storyObj.hero = hero.innerText;
        }
        let storyDescription = el.closest("tr").querySelector(".descriptionList .languageOfChoice td");
        if (storyDescription){
            storyObj.description = storyDescription.innerText;
        }
        return storyObj;
    })
    return stories;
}

function getListOfAppearances(doc){
    let appearanceElements = doc.querySelectorAll(".content a[href*=character]");
    let appearances = appearanceElements.map((el) => {
        return el.innerText;
    });
    return [...new Set(appearances)];
}

function getListOfCreators(doc){
    let creatorElements = doc.querySelectorAll(".content a[href*=creator]:not([href*='%3F']):not([href*='%3f'])");
    let creators = creatorElements.map((el) => {
        return el.innerText;
    });
    return [...new Set(creators)];
}
