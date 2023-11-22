import './App.css';
import React, { useState } from 'react';

function App() {
  const [value, setValue] = useState('');

  const handleSubmit = async (event) => {
  event.preventDefault();
  document.getElementById('content').innerHTML = "";  //removes the previous content

    var patient;
    try{
      patient = JSON.parse(value)
    }
    catch(error){
      console.log(error.message)
      document.getElementById('errorMsg').innerHTML = `<b>Invalid JSON format: ${error.message}</b>`
      return;
    }

  console.log(patient);


    const data = {
      method: 'POST',
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(patient), 
    };
    const response = await fetch('http://localhost:9090/sampleResource', data);
    const content = await response.text(); 
    console.log("Error message from server");
    console.log(content); 

    if (!content){
      document.getElementById('errorMsg').innerHTML = `<b>Validation successful</b>`
      return;
    }else{
      document.getElementById('errorMsg').innerHTML = `<b>${content}</b>`
    }
    

//Key validation------------------------------------------------------

    const pattern = /field\s+'([^']+)'/g;
    const parserMatch = content.matchAll(pattern);

    var fieldValue = [];
    for (const match of parserMatch){
      if (match && match.length ===2){
        fieldValue.push(match[1]);
        console.log(`Field Value  ${fieldValue}`);
      }else{
        console.log("No match found.");
      }
    }



//Value validation------------------------------------------------------

if (fieldValue){
    //Eg; if fieldValue is telecom[1].system, this regular expression will return an array ["telecom", 1, "system"]
    var pattern2 = /(\w+)\[(\d+)\]\.(\w+)/;
    // Use the pattern to match and extract values
    try {
      for (const fieldvalue of fieldValue){
          var match = fieldvalue.match(pattern2);

          if (match !== null) {
            //Navigating to the value in the JSON object
            const currentValue = patient[match[1]][match[2]][match[3]];
            console.log("currentValue = ", currentValue);

            const modifiedValue = "$$" + currentValue;
            console.log("modifiedValue = ", modifiedValue);

            // Update the value in the JSON object
            patient[match[1]][match[2]][match[3]] = modifiedValue;
          }
    }
    } catch (error) {
      console.error(error);
    }
  }


//Resource type validation------------------------------------------------------

/*This will search error for below string and if there is a match the
error is with the resourceType field*/ 
var pattern3 = /(Failed to find FHIR profile for the resource type)/;
const parserMatch2 = content.match(pattern3);

if (parserMatch2 && parserMatch2.length === 2) {
  fieldValue.push("resourceType");
  console.log(`Field Value : ${fieldValue}`);
} else {
  console.log("No resource type match found.");
}





/*TODO  2)Implement parsing for constraints */


    

function findLineNo(obj, searchString, currentLine=0) {

  for (var key in obj) { 

    if(key === searchString || key === ""){  //if key is empty string, then the error is with the resourceType
        let entries = Object.entries(obj);   //Similar to map

        // Iterate over the array
        for (let i = 0; i < entries.length; i++) {
            if (entries[i][0] === key) {
                // Replace the key
                entries[i][0] = '$$' + key;
            }
        } 
        // Convert array back to object
        obj = Object.fromEntries(entries);
    
        console.log(obj)
        return obj;
    }

    /*Here if the current key has an object as the value, this will execute*/ 
    if(typeof obj[key] === 'object' ){
      /*If the current key's value is an array containing many objects, then the else will execute therby recursively executing 
      findLineNo for each object in the array. But if the current key's value is just a simple object, the the "if" will run
      executind findLineNo for the current object*/
       if(!Array.isArray(obj[key])){

          var obj2 = findLineNo(obj[key], searchString, currentLine);
          obj[key] = obj2;

      }else{    
          for( const arrayElementIndex  in obj[key]){

             var obb = findLineNo(obj[key][arrayElementIndex ], searchString, currentLine);
             obj[key][arrayElementIndex ] = obb;

          }  
      }
  
    }
  }

  return obj;
}


for (const val of fieldValue){
  console.log(val)
}

const originalJSON = JSON.stringify(patient)
console.log("------Original object--------");
console.log(originalJSON);


var jsonAfterLoop;
for (const field of fieldValue){
  jsonAfterLoop= findLineNo(patient,field);
  patient = jsonAfterLoop;
}
const strAfterLoop = JSON.stringify(jsonAfterLoop)
console.log("------FInal object--------");
console.log(strAfterLoop);

var jsonStringg = JSON.stringify(jsonAfterLoop, null, 2); // 2 is the number of spaces for indentation

if (jsonStringg){
    let linesArr = jsonStringg.split("\n");
    console.log(linesArr);

    for (let i = 0; i < linesArr.length; i++){
      if (linesArr[i].includes("$$")){
        linesArr[i] = linesArr[i].replace("$$", "");
        linesArr[i] = `<span className="line">${linesArr[i]}</span>`;

      }
    }
    console.log(linesArr);
    let modifiedJsonStringg = linesArr.join("\n");
    document.getElementById('content').innerHTML = `<pre>${modifiedJsonStringg}</pre>`;
    }

};

  return (
    <div className="App">
      <div className='container'>
        <form onSubmit={handleSubmit}>
          <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={28} cols={40} />
          <button >Submit</button>
        </form>
        <div id='content'></div>     
        <div id='errorMsg'></div>    
      </div>
    </div>
  );
}

export default App;
