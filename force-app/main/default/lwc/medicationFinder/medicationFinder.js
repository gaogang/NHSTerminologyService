import { LightningElement } from 'lwc';

export default class MedicationFinder extends LightningElement {
    searching = '';
    results = [];

    token = '';

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
            .then(token => {
                fetch("https://ontology.nhs.uk/production1/fhir/ValueSet/$expand?url=https://dmd.nhs.uk/ValueSet/VMP&count=10&&filter=" + this.searching + "&property=*", {
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
            fetch("https://ontology.nhs.uk/production1/fhir/ValueSet/$expand?url=https://dmd.nhs.uk/ValueSet/VMP&count=10&&filter=" + this.searching + "&property=*", {
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

    clickHandler(event) {
        alert('click');
    }

    showResult() {
        var divblock = this.template.querySelector('[data-id="searchresults"]');
        if(divblock){
            divblock.className='c-container slds-visible';
        }
    }

    hideResult() {
        var divblock = this.template.querySelector('[data-id="searchresults"]');
        if(divblock){
            divblock.className='c-container slds-hidden';
        }
    }
}