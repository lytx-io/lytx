import { PageEvent, parseData } from "@/templates/lytxpixel";
import { trackEvents } from "@/templates/trackWebEvents";
const dataVariableName = "lytxDataLayer" as const;

// Comprehensive function cleaner for build artifacts
function cleanFunctionForEmbedding(func: Function): string {
    let source = func.toString();

    // Remove all variations of __name and @__PURE__ annotations
    source = source
        // Remove standalone @__PURE__ comments
        .replace(/\/\*\s*@__PURE__\s*\*\/\s*/g, '')
        // Remove __name calls with various patterns
        .replace(/__name\s*\([^)]*\)\s*[,;]?\s*/g, '')
        // Remove combined patterns like "= /* @__PURE__ */ __name("
        .replace(/=\s*\/\*\s*@__PURE__\s*\*\/\s*__name\s*\([^,)]*,\s*[^)]*\)/g, '= ')
        // Remove const declarations with __name
        .replace(/const\s+(\w+)\s*=\s*\/\*\s*@__PURE__\s*\*\/\s*__name\s*\([^,)]*,\s*[^)]*\)/g, 'const $1 = ')
        // Clean up function expressions
        .replace(/function\s*\(\)\s*\{\s*return\s*([^}]+)\s*\}\s*\(\)/g, '$1')
        // Remove any remaining __name references
        .replace(/__name/g, '')
        // Clean up extra commas and semicolons
        .replace(/,\s*[,;]/g, ',')
        .replace(/;\s*;/g, ';')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();

    return source;
}
type TagConfig = { site: string, tag: string, track_web_events: boolean, gdpr: boolean };
type QueryParams = {
    [key: string]: string[];
};
type DataVariableName = typeof dataVariableName;

type ScriptConfig = { config: TagConfig, queryParamsStr?: string, data: PageEvent[], dataVariableName: DataVariableName };
//TODO fix types for config and queryParamsStr
export function generateScript(conf: ScriptConfig) {
    const { config, queryParamsStr, data, dataVariableName } = conf;


    //TODO check these
    const dataObjects = data.map(item => {
        return `
            {
                event_name: ${JSON.stringify(item.event_name)},
                condition: ${JSON.stringify(item.condition)},
                data_passback: ${JSON.stringify(item.data_passback)},
                parameters: ${JSON.stringify(item.parameters)},
                paramConfig: ${JSON.stringify(item.paramConfig)},
                query_parameters: ${JSON.stringify(item.query_parameters)},
                customScript: ${JSON.stringify(item.customScript)},
                rules: ${JSON.stringify(item.rules)},
                Notes: ${JSON.stringify(item.Notes)}
            }
        `;
    }).join(',');

    //part to impor

    //!dont forget to check for config gdp and change data

    //var config = ${JSON.stringify(config)};
    //var queryParamsStr = "${queryParamsStr}";
    const jsTemplate = `
        (function() {
            const dataVariableName = [${dataObjects}];
            
            
            if(window.${dataVariableName}){
                window.${dataVariableName}.push(
                  {site:"${config.site}",tag:"${config.tag}",events:${dataVariableName},tracked:[]}
                )
            }else{
                window.${dataVariableName} = [
                  {site:"${config.site}",tag:"${config.tag}",events:${dataVariableName},tracked:[]}
                ]
            }

            //parseData
            //trackEvents
            ${cleanFunctionForEmbedding(parseData)}
            ${cleanFunctionForEmbedding(trackEvents)}
            parseData(${dataVariableName},{site:"${config.site}",tag:"${config.tag}"},trackEvents,${config.track_web_events},'{{platform}}');
            //replace handlebars

            parseData(${dataVariableName},{site:"${config.site}",tag:"${config.tag}"},trackEvents,${config.track_web_events},'{{platform}}');
            ${config.track_web_events
            ? `trackEvents("${config.tag}",'{{platform}}',null,'{{{macros}}}');`
            : ``
        }
              window.lytxApi.event = trackEvents;
              window.lytxApi.capture = function(eventName, customData) {
                window.lytxApi.event("${config.tag}", "{{platform}}", { custom: eventName }, "", customData || undefined);
              };
        })();
    `;

    return jsTemplate;
}




function buildQueryString(queryParams: QueryParams): string {
    // Filter out unwanted keys
    const filteredParams = Object.entries(queryParams).filter(([key]) => key !== 'account' && key !== 'platform');

    // Convert the object to a query string
    const queryString = filteredParams.map(([key, value]) => {
        return encodeURIComponent(key) + '=' + encodeURIComponent(value.join('&'));
    }).join('&');

    return queryString ? `&${queryString}` : '';
}
