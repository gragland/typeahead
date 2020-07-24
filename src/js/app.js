import React from 'react';
import Results from './components/results.js';
import InputComponent from './components/input.js';
import Loading from './components/loading.js';
import rawStyle from './../less/style.less';

// For older versions of React (deprecated in 0.14)
if (typeof React.initializeTouchEvents === 'function'){
  React.initializeTouchEvents(true);
}

const EMPTY_ARRAY = [];

class Instatype extends React.PureComponent {

  constructor(props) {
    super(props);
    
    this.state = { 
      inputValue: '', // Current value of input
      showResults: false, // Show or hide results
      loading: false, // Are we currently loading data from server?
      results: EMPTY_ARRAY, // Data populating the results dropdown
      resultsQuery: null // Search string for displayed results
    };
    
    this.loadResultsFromServer = this.loadResultsFromServer.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.showResults = this.showResults.bind(this);
    this.hideResults = this.hideResults.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleTouch = this.handleTouch.bind(this);
    this.clearState = this.clearState.bind(this);
    this.blurInput = this.blurInput.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
  }

  componentDidMount() {



    // Blur the input when the user touches (ontouchstart) anywhere on the screen.
    // This fixes a nasty bug (on ios in phonegap webview) where a natural blur (due to clicking somewhere on screen) ...
    // ... will result in the input's blinking caret not displaying next time the input is in focus.
    // Triggering a blur manually ontouchstart seems to solve this problem.
    // Capture phase (rather than bubbling phase) so that it's called before any other events
    if (this.props.blurOnTouchStart === true){
      document.addEventListener('touchstart', this.blurInput, true); 
    }
  }

  componentWillUnmount(){

    // Cancel timeout or we could end up setting state for component that isn't mounted
    clearTimeout(window.blurHideResultsTimeout);

    if (this.props.blurOnTouchStart === true){
      document.removeEventListener('touchstart', this.blurInput, true);
    }
  }

  loadResultsFromServer(query) {
    this.setState({ loading: true });

    const commitResult = (data) => {
      this.setState({
        results: data,
        resultsQuery: query,
        loading: false
      });
    }

    this.props.requestHandler(query, this.props.limit, (data) => {
      // If inputValue changed prior to request completing don't bother to render
      if (this.state.inputValue != query){
        return false;
      }

      if (data) {
        // Truncate data to specific limit
        data = data.slice(0, this.props.limit);
        commitResult(data);
      } else {
        commitResult([]);
      }
    });
  }

  handleSelect(selectedResult) {
    this.props.selectedHandler(selectedResult);
    this.clearState();
  }

  handleChange(query) {

    clearTimeout(window.loadResultsTimeout);

    if (query){

      this.setState({ inputValue: query });

      window.loadResultsTimeout = setTimeout(() => {
        this.loadResultsFromServer(query);
      }, 200);

    }else{

      this.clearState();
    }
      
  }

  showResults(){

    if (this.state.showResults === false){
      this.setState({ showResults : true });
    }

    // Cancel any pending hide results timeout
    clearTimeout(window.blurHideResultsTimeout); 
  }

  hideResults(){

    if (this.state.showResults === true){
      this.setState({ showResults : false });
    }

    // Cancel any pending hide results timeout
    clearTimeout(window.blurHideResultsTimeout); 
  }

  handleFocus() {
      this.showResults();
  }

  handleBlur(event) {

    // Hide results after a 400ms delay
    // This gives us the ability to keep results open by canceling this timeout
    // TODO: Find a cleaner way to do this
    window.blurHideResultsTimeout = setTimeout(() => {
      this.hideResults(); // Hide
    }, 400);

    // Slight timeout so that selectedHandler() gets called before props.onBlur
    // This is important because if props.onBlur causes Instatype component to be removed from DOM ...
    // ... then selectedHandler() will never get called
    if (this.props.onBlur){
      setTimeout(() => {
        this.props.onBlur();
      }, 10);
    }
  }

  // Attached to #instatype div onTouchStart
  // Cancels delayed hiding of results (see this.handleBlur) so menu stays open when result tapped and scrolling
  handleTouch(){

    // If we are NOT auto-blurring on touch, we need to do it here
    if (this.props.blurOnTouchStart === false){
      this.blurInput();
    }
    
    // Prevents results from hiding
    clearTimeout(window.blurHideResultsTimeout);
  }

  clearState() {
    this.setState({
      results: EMPTY_ARRAY, 
      resultsQuery: null, 
      inputValue: '', 
      loading: false
    });
  }

  blurInput(){
    this.refs.inputComponent.refs.input.blur();
  }

  render(){

    const { data, defaultInputValue, placeholder, loadingIcon, thumbStyle } = this.props;
    const { results, resultsQuery, showResults, loading } = this.state;

    return (
      <div id="instatype" onTouchStart={this.handleTouch}>

        {/* Embedded style for server-rendering support */}
        <style dangerouslySetInnerHTML={{__html: rawStyle}} />
   
        <div className="input-wrapper">
          <InputComponent
            defaultValue={defaultInputValue}
            placeholder={placeholder} 
            handleChange={this.handleChange} 
            handleFocus={this.handleFocus} 
            handleBlur={this.handleBlur} 
            ref="inputComponent" />

          { loading &&
            <Loading icon={loadingIcon || undefined} />
          }
        </div>
          
        { showResults && 
          <Results 
            data={data ? data : results} 
            resultsId={resultsQuery} 
            handleSelect={this.handleSelect} 
            thumbStyle={thumbStyle} />
        }
      </div>
    );
  }
};

Instatype.propTypes = {
  limit: React.PropTypes.number,
  defaultInputValue: React.PropTypes.string,
  placeholder: React.PropTypes.string,
  thumbStyle: React.PropTypes.oneOf(['circle', 'square']),
  loadingIcon: React.PropTypes.string,
  blurOnTouchStart: React.PropTypes.bool,
  onBlur: React.PropTypes.func,
  requestHandler: React.PropTypes.func.isRequired,
  selectedHandler: React.PropTypes.func.isRequired,
  data: React.PropTypes.arrayOf(
    React.PropTypes.shape({
      image: React.PropTypes.string,
      name: React.PropTypes.string.isRequired
    })
  ),
};

Instatype.defaultProps = {
  limit: 10,
  defaultInputValue: null,
  placeholder: 'Search',
  thumbStyle: 'square',
  loadingIcon: null,
  // Blur input ontouchstart. 
  // Fixes an phonegap/ios bug where input cursor doesn't show up on focus after previously blurring naturally
  // Don't enable unless experiencing this bug
  blurOnTouchStart: false,
  data: null,
};

// NOTE: Don't do an ES6 "export default Instatype" 
// Otherwise our standalone browser script /dist/instatype.js has the component at instatype.default (rather then just instatype)
module.exports = Instatype;

