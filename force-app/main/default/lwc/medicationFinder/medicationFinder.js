import TickerSymbol from '@salesforce/schema/Account.TickerSymbol';
import { LightningElement } from 'lwc';

export default class MedicationFinder extends LightningElement {
    searching = '';
    results = [];

    token = '';

    sel_name = "xxxxx";
    sel_code = "xxxxx";
    sel_type = "xxxxx";
    sel_vmp = [];
    sel_dfi = 'xxxxxx';
    sel_udfs = 0;
    sel_udfs_uom = 'xxxxxx';
    sel_unitdose_uom = 'xxxxxx';
    sel_prescribing_status = 'xxxxxx';
    sel_controlled_drug_category = 'xxxxxx';
    sel_route = 'xxxxxx';
    sel_form = 'xxxxxx';
    sel_ontology_form = 'xxxxxx';
    sel_basis = 'xxxxxx';

    codingSystems = [];

    changeHandler(event) {
        this.searching = event.target.value;
        if (this.searching.length < 3) {
            console.log('Reset searching results...');
            this.results = [];
            this.hideResult();
            return;
        }

        if (this.token === '') {
            console.log('Access token not available - re-authenticate...');
            fetch("https://ontology.nhs.uk/authorisation/auth/realms/nhs-digital-terminology/protocol/openid-connect/token", {
                method: 'POST',
                body: 'grant_type=client_credentials&client_id=Salesforce_Consumer&client_secret=058a1404-26c4-450b-9acd-894610bfaed8',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
            .then(response => {
                console.log('Access token acquired');
                return response.json();
            })
            .then(json => {
                this.token = json.access_token;
                return this.token;
            })
            // Search for VTM
            .then(token => {
                fetch("https://ontology.nhs.uk/production1/fhir/ValueSet/$expand?url=https://dmd.nhs.uk/ValueSet/VTM&count=10&&filter=" + this.searching + "&property=*", {
                    method: 'GET',
                    credentials: 'same-origin' ,
                    headers: {
                        'content-type': 'application/json',
                        'authorization': 'Bearer ' + token
                    }
                })
                .then(response => {
                    return response.json();
                })
                .then(json => {
                    this.showResult();
                    this.results = json.expansion.contains;
                });
            });
        } else {
            console.log('Access token available - start searching...');
            fetch("https://ontology.nhs.uk/production1/fhir/ValueSet/$expand?url=https://dmd.nhs.uk/ValueSet/VTM&count=10&&filter=" + this.searching + "&property=*", {
                method: 'GET',
                credentials: 'same-origin' ,
                headers: {
                    'content-type': 'application/json',
                    'authorization': 'Bearer ' + this.token
                }
            })
            .then(response => {
                return response.json();
            })
            .then(json => {
                this.showResult();
                this.results = json.expansion.contains;
            });
        }
    }

    vtmClickHandler(event) {
        this.sel_code = event.currentTarget.getAttribute('id').replace('-93', '');

        this.sel_vmp = [];
        var searchingCodes = "";
        // Search for VTM
        fetch("https://ontology.nhs.uk/production1/fhir/CodeSystem/$lookup?system=https://dmd.nhs.uk&code=" + this.sel_code + "&property=*", {
            method: 'GET',
            credentials: 'same-origin' ,
            headers: {
                'content-type': 'application/json',
                'authorization': 'Bearer ' + this.token
            }
        })
        .then(response => {
            return response.json();
        })
        .then(json => {
            json.parameter.forEach(element => {
                if(element.name === 'property') {
                    if (element.part[0].name === 'code' && 
                        element.part[0].valueCode === 'child' &&
                        element.part[1].name === 'value') {
                        searchingCodes = searchingCodes + element.part[1].valueCode + ",";
                    }
                }
            });

            if (searchingCodes.length !== 0) {
                var body = '{"resourceType": "Parameters", "parameter": [{"name": "valueSet", "resource": {"resourceType": "ValueSet", "compose": {"include": [{"system": "https://dmd.nhs.uk", "filter": [{"property": "code", "op": "in", "value": "' + searchingCodes +'"}]}]}}}, {"name": "count", "valueInteger": 100}]}';
                // Search for the VMPs
                fetch("https://ontology.nhs.uk/production1/fhir/ValueSet/$expand", {
                    method: 'POST',
                    credentials: 'same-origin' ,
                    headers: {
                        'content-type': 'application/json',
                        'authorization': 'Bearer ' + this.token
                    },
                    body: body
                })
                .then(response => {
                    return response.json();
                })
                .then(json => {
                    this.sel_vmp = json.expansion.contains;
                });
            }
            this.showVTM();
        });
    }

    vmpClickHandler(event) {
        this.sel_code = event.currentTarget.getAttribute('id').replace('-93', '');
        var medicationDetails = [];

        console.log("Code: " + this.sel_code);
        // Search for VMP
        fetch("https://ontology.nhs.uk/production1/fhir/CodeSystem/$lookup?system=https://dmd.nhs.uk&code=" + this.sel_code + "&property=*", {
            method: 'GET',
            credentials: 'same-origin' ,
            headers: {
                'content-type': 'application/json',
                'authorization': 'Bearer ' + this.token
            }
        })
        .then(response => {
            return response.json();
        })
        .then(json => {
            console.log("Medication found! - " + JSON.stringify(json));
            var codeSearching = [];
            var counter = 0;
            json.parameter.forEach(element => {
                if (element.name === 'display') {
                    this.sel_name = element.valueString;
                } else if(element.name === 'property') {
                    if (element.part.length >= 2) {
                        // Determine medication type
                        if (element.part[0].name === 'code' && 
                            element.part[0].valueCode === 'parent' && 
                            element.part[1].name === 'value') { 
                            if (element.part[1].valueCode === 'VTM') {
                                this.sel_type = 'VTM';
                            } else if (element.part[1].valueCode === 'VMP') {
                                this.sel_type = 'VMP';
                            } else if (element.part[1].valueCode === 'AMP') {
                                this.sel_type = 'AMP';
                            }
                        }

                        if (element.part[0].name === 'code' &&
                            element.part[1].name === 'valueCoding') {
                            console.log(counter + ": system - " + element.part[1].valueCoding.system + " code - " + element.part[1].valueCoding.code);
                            var system = element.part[1].valueCoding.system;
                            var code = element.part[1].valueCoding.code;
                            var display = this.getDisplay(system, code);

                            if (display === '') {
                                // Add code to the searching list
                                var systemExist = false;
                                codeSearching.forEach(cs => {
                                    if (cs.system === system) {
                                        cs.code.push(code);
                                        systemExist = true;
                                    }
                                });

                                if (!systemExist) {
                                    codeSearching.push({
                                        system: system,
                                        code: [code]
                                    });
                                }
                            }

                            medicationDetails.push({
                                name: element.part[0].valueCode,
                                system: system,
                                code: code,
                                display: display
                            });
                        }
                    }
                }
            });

            // search for the missing display
            var codeSearchingLength = codeSearching.length;
            if (codeSearchingLength !== 0) {
                var systemString = '';
                var codeSearchingCount = 0;
                codeSearching.forEach(s => {
                    systemString += '{"system" : "' + s.system + '", "filter": [{"property": "code", "op": "in", "value": "';
                    s.code.forEach(c => {
                        systemString += c + ", "
                    });

                    systemString += '"}]}';
                    
                    if (codeSearchingCount < codeSearchingLength - 1) {
                        systemString += ", ";
                        codeSearchingCount++;
                    }
                });

                var body = '{"resourceType": "Parameters", "parameter": [{"name": "valueSet", "resource": {"resourceType": "ValueSet", "compose": {"include": [' + systemString +']}}}, {"name": "count", "valueInteger": 100}]}';

                console.log('Searching for missing display - ' + body);

                // Search for the VMPs
                fetch("https://ontology.nhs.uk/production1/fhir/ValueSet/$expand", {
                    method: 'POST',
                    credentials: 'same-origin' ,
                    headers: {
                        'content-type': 'application/json',
                        'authorization': 'Bearer ' + this.token
                    },
                    body: body
                })
                .then(response => {
                    return response.json();
                })
                .then(json => {
                    json.expansion.contains.forEach(c => {
                        medicationDetails.forEach(d => {
                            if (d.system === c.system &&
                                d.code === c.code) {
                                console.log('Set missing display - ' + c.display);
                                d.display = c.display;
                            }
                        });
                    });
                    console.log('medication details - ' + JSON.stringify(medicationDetails));
                    this.updateMedicationDetails(medicationDetails);
                    this.showVMP();
                });
            } else {
                this.updateMedicationDetails(medicationDetails);
                this.showVMP();
            }
        });
    }

    showResult() {
        var divblock = this.template.querySelector('[data-id="searchresults"]');
        if(divblock){
            divblock.className='c-container slds-show';
        }
    }

    showVTM() {
        this.hideVMP();
        var divblock = this.template.querySelector('[data-id="vtmresults"]');
        if(divblock){
            divblock.className='slds-show';
        }
    }

    showVMP() {
        this.hideVTM();
        var divblock = this.template.querySelector('[data-id="vmpresults"]');
        if(divblock){
            divblock.className='slds-show';
        }
    }

    hideResult() {
        var divblock = this.template.querySelector('[data-id="searchresults"]');
        if(divblock){
            divblock.className='c-container slds-hide';
        }
    }

    hideVTM() {
        var divblock = this.template.querySelector('[data-id="vtmresults"]');
        if(divblock){
            divblock.className='slds-hide';
        }
    }

    hideVMP() {
        var divblock = this.template.querySelector('[data-id="vmpresults"]');
        if(divblock){
            divblock.className='slds-hide';
        }
    }

    getDisplay(system, code) {
        var display = '';
        if (this.codingSystems[system]) {
            this.codingSystems[system].forEach(s => {
                if (s === code) {
                    display = s.display;
                }
            });
        }
        return display;
    }

    updateMedicationDetails(medicationDetails) {
        medicationDetails.forEach(d => {
            if (d.name === 'DF_INDCD') {
                this.sel_dfi = d.display;
            } else if (d.name === 'UDFS') {
                this.sel_udfs = d.display;
            } else if (d.name === 'UDFS_UOMCD') {
                this.sel_udfs_uom = d.display;
            } else if (d.name === 'UNIT_DOSE_UOMCD') {
                this.sel_unitdose_uom = d.display;
            } else if (d.name === 'PRES_STATCD') {
                this.sel_prescribing_status = d.display;
            } else if (d.name === 'CATCD') {
                this.sel_controlled_drug_category = d.display;
            } else if (d.name === 'ROUTECD') {
                this.sel_route = d.display;
            } else if (d.name === 'FORMCD') {
                this.sel_form = d.display;
            } else if (d.name === 'ONTFORMCD') {
                this.sel_ontology_form = d.display;
            } else if (d.name === 'BASISCD') {
                this.sel_basis = d.display;
            }
        });
    }
}