// macros3.rs
// Make me compile, without taking the macro out of the module!
// Execute `rustlings hint macros3` for hints :)

#[macro_use]
mod macros {
    macro_rules! my_macro {
        () => {
            println!("Check out my macro!");
        };
    }
    // pub(crate) use bar;    // <-- also does the trick
}
fn main() {
    my_macro!();
}
